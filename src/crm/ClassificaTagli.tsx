/** ── QUALI TAGLI SCEGLIE LA GENTE ──────────────────────────────────────────
 *
 *  La classifica interna della prova capelli: quante volte è stato scelto ogni
 *  taglio, quale colore va per la maggiore, e quante persone hanno portato una
 *  loro fotografia invece di scegliere dal catalogo.
 *
 *  ── ⚠️ SI VEDE ANCHE LA CODA, NON SOLO I PRIMI ───────────────────────────
 *  Una classifica dei primi cinque dice quali funzionano; questa dice anche
 *  quali NON li tocca nessuno — che è la metà che si può usare. Venti riquadri
 *  mai scelti non sono varietà: sono un muro da attraversare per arrivare ai
 *  quattro che interessano. Per questo i tagli a zero restano in elenco, in
 *  fondo e in grigio, invece di sparire.
 *
 *  ── ⚠️ E SI DICE DA QUANDO ───────────────────────────────────────────────
 *  «43 scelte» non vuol dire niente senza sapere se sono di ieri o di sei
 *  mesi: la data della prima e dell'ultima prova stanno in cima.
 */
import { useEffect, useState } from "react";
import { BarChart3, Camera, Loader2, RefreshCw } from "lucide-react";
import { fetchCRM } from "@/crm/AuthContext";

interface Riga {
  chiave: string;
  nome: string;
  quante: number;
  quota: number;
  famiglia?: string;
}
interface Dati {
  totale: number;
  daFoto: number;
  dal: string | null;
  al: string | null;
  tagli: Riga[];
  colori: Riga[];
}

const giorno = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })
    : "";

/** La barra: larga quanto la quota sul primo, non sul totale. Sul totale, con
 *  venticinque tagli, la barra più lunga sarebbe un quinto della riga e non si
 *  distinguerebbe da quella sotto. */
function Barra({ quante, massimo }: { quante: number; massimo: number }) {
  const largo = massimo > 0 ? Math.round((quante * 100) / massimo) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full ${quante > 0 ? "bg-violet-500" : "bg-transparent"}`}
        style={{ width: `${largo}%` }}
      />
    </div>
  );
}

export function ClassificaTagli() {
  const [dati, setDati] = useState<Dati | null>(null);
  const [carico, setCarico] = useState(true);
  const [errore, setErrore] = useState("");

  const carica = async () => {
    setCarico(true);
    setErrore("");
    try {
      const r = await fetchCRM("/api/crm/prova-capelli");
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "non riesco a leggere la classifica");
      setDati(j as Dati);
    } catch (e) {
      setErrore(String((e as Error).message || e));
    } finally {
      setCarico(false);
    }
  };

  useEffect(() => {
    void carica();
  }, []);

  if (carico && !dati) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Sto contando…
      </p>
    );
  }
  if (errore) return <p className="py-4 text-sm text-destructive">{errore}</p>;
  if (!dati) return null;

  //  ⚠️ Zero prove non è un errore ed è il caso di TUTTI i primi giorni: si
  //   dice cosa manca, non si mostra una classifica vuota che sembra rotta.
  if (!dati.totale) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <BarChart3 className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
        <p className="text-sm font-medium">Nessuno ha ancora provato un taglio</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          La classifica si riempie da sola: ogni prova andata a buon fine conta uno.
        </p>
      </div>
    );
  }

  const massimo = Math.max(1, ...dati.tagli.map((t) => t.quante));
  const provati = dati.tagli.filter((t) => t.quante > 0).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <p className="text-2xl font-semibold tabular-nums">{dati.totale}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">prove fatte</p>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums">
            {provati}
            <span className="text-base text-muted-foreground">/{dati.tagli.length}</span>
          </p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            tagli mai scelti: {dati.tagli.length - provati}
          </p>
        </div>
        <div>
          <p className="flex items-baseline gap-1.5 text-2xl font-semibold tabular-nums">
            <Camera className="h-4 w-4 text-muted-foreground" />
            {dati.daFoto}
          </p>
          {/*  ⚠️ Questo numero è un avviso, non una curiosità: se sale sopra i
              tagli del catalogo vuol dire che il catalogo non ha quello che la
              gente cerca. */}
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            taglio portato da una foto
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {!!dati.dal && (
            <p className="text-[11px] text-muted-foreground">
              dal {giorno(dati.dal)} al {giorno(dati.al)}
            </p>
          )}
          <button
            onClick={() => void carica()}
            className="flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${carico ? "animate-spin" : ""}`} /> Aggiorna
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          I tagli, dal più scelto
        </p>
        <ol className="space-y-1.5">
          {dati.tagli.map((t, i) => (
            <li
              key={t.chiave}
              className={`flex items-center gap-3 ${t.quante ? "" : "opacity-45"}`}
            >
              <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              {/*  La miniatura: in una classifica di tagli, il nome da solo
                  costringe a ricordarsi com'era fatto. */}
              <img
                src={`/tagli/${t.chiave}.jpg`}
                alt=""
                loading="lazy"
                className="h-8 w-8 shrink-0 rounded object-cover"
                onError={(e) => {
                  e.currentTarget.style.visibility = "hidden";
                }}
              />
              <span className="w-40 shrink-0 truncate text-[13px] font-medium">{t.nome}</span>
              <span className="hidden w-20 shrink-0 truncate text-[11px] text-muted-foreground sm:block">
                {t.famiglia}
              </span>
              <span className="min-w-0 flex-1">
                <Barra quante={t.quante} massimo={massimo} />
              </span>
              <span className="w-10 shrink-0 text-right text-[13px] font-semibold tabular-nums">
                {t.quante}
              </span>
              <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                {t.quota}%
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          I colori
        </p>
        <div className="flex flex-wrap gap-1.5">
          {dati.colori
            .filter((c) => c.quante > 0)
            .map((c) => (
              <span key={c.chiave} className="rounded-full border px-2.5 py-1 text-[12px]">
                {c.nome} <span className="font-semibold tabular-nums">{c.quante}</span>
              </span>
            ))}
          {!dati.colori.some((c) => c.quante > 0) && (
            <span className="text-[12px] text-muted-foreground">Nessun colore scelto finora.</span>
          )}
        </div>
      </div>
    </div>
  );
}
