/** ── TUTTI I PREVENTIVI DEL GRUPPO, IN PARALLELO ───────────────────────────
 *  Una scheda per ogni persona che ha il suo preventivo acceso, affiancate,
 *  aggiornate nell'istante in cui toccano qualcosa. Le regole (che cosa dice
 *  una scheda, chi ce l'ha, quando uno «sta compilando») stanno in
 *  shop/vista-parallela, provate senza browser; qui c'è solo il disegno e il
 *  filo con le stanze.
 *
 *  ⚠️ UN COLLEGAMENTO TUTTO SUO AL TEMPO REALE. La libreria di Supabase, a
 *   parità di nome del canale, restituisce LO STESSO canale: la pagina del
 *   preventivo ascolta già la stanza che il consulente ha aperta, e chiudendo
 *   queste schede si sarebbe staccata anche lei — in mezzo alla consulenza.
 *   Un client separato ha i suoi canali e li chiude senza toccare quelli degli
 *   altri.
 *  ⚠️ LA RETE DI SICUREZZA COSTA POCO E SOLO A SCHEDE APERTE: lo stato si
 *   rilegge dal server ogni dieci secondi, una richiesta per persona. Il canale
 *   fa il lavoro vero; il giro serve a chi si è collegato da una rete che il
 *   tempo reale non lo regge.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { PenLine, X } from "lucide-react";
import { formatPrice } from "@/shop/catalog";
import { buildMenu, type PricingOverrides } from "@/shop/quote-menu";
import { stanzaDelPreventivo } from "@/shop/preventivi-di-gruppo";
import { attivita, schedaDelPreventivo, type StatoVivo } from "@/shop/vista-parallela";

export type PersonaInParallelo = { gettone: string; nome: string };

/** Un client solo per tutte le aperture della vista: aprirne uno a ogni
 *  apertura vorrebbe dire un collegamento in più ogni volta. */
let clientParallelo: ReturnType<typeof createClient> | null = null;
function clientDellaVista() {
  if (clientParallelo) return clientParallelo;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const chiave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!url || !chiave) return null;
  clientParallelo = createClient(url, chiave, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: "hg-vista-parallela" },
  });
  return clientParallelo;
}

const GIRO_MS = 10_000;

export function VistaParallela({
  code,
  persone,
  onChiudi,
  onIntervieni,
}: {
  code: string;
  persone: PersonaInParallelo[];
  onChiudi: () => void;
  /** Apre il suo preventivo sul mio schermo: lo compiliamo insieme. */
  onIntervieni: (p: PersonaInParallelo) => void;
}) {
  const [listino, setListino] = useState<PricingOverrides | null>(null);
  const [stati, setStati] = useState<Record<string, StatoVivo>>({});
  const [tocchi, setTocchi] = useState<Record<string, number>>({});
  const [adesso, setAdesso] = useState(() => Date.now());
  const chiave = persone.map((p) => p.gettone).join(",");

  //  Il listino della consulenza: quello di chi la conduce (vedi conSessione
  //  in routes/preventivo), una volta sola.
  useEffect(() => {
    let vivo = true;
    fetch(`/api/public/pricing?sess=${encodeURIComponent(code)}`)
      .then((r) => r.text())
      .then((t) => { if (vivo) setListino(JSON.parse(t) as PricingOverrides); })
      .catch(() => { if (vivo) setListino({}); });
    return () => { vivo = false; };
  }, [code]);

  //  Le stanze: canale per l'istante, server per la convergenza.
  useEffect(() => {
    const nuovo = (g: string, s: unknown, tocco: boolean) => {
      if (!s || typeof s !== "object") return;
      setStati((prima) => ({ ...prima, [g]: s as StatoVivo }));
      if (tocco) setTocchi((prima) => ({ ...prima, [g]: Date.now() }));
    };
    const leggi = (g: string) =>
      fetch(`/api/presenter/quotestate?sess=${encodeURIComponent(stanzaDelPreventivo(code, g))}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { state?: unknown; ts?: number } | null) => {
          if (!j?.state) return;
          nuovo(g, j.state, false);
          //  L'ora dell'ultimo salvataggio è un tocco anche lei: chi si collega
          //  a consulenza avviata deve sapere da quanto ognuno è fermo.
          if (j.ts) setTocchi((prima) => ({ ...prima, [g]: Math.max(prima[g] || 0, Number(j.ts) || 0) }));
        })
        .catch(() => { /* rete: si riprova al giro dopo */ });

    const sb = clientDellaVista();
    const canali = sb
      ? persone.map((p) => {
          const ch = sb.channel(`qlive-${stanzaDelPreventivo(code, p.gettone)}`, {
            config: { broadcast: { self: false } },
          });
          ch.on("broadcast", { event: "state" }, ({ payload }) => nuovo(p.gettone, payload, true));
          //  Lo scorrimento non cambia la scheda ma dice che è lì.
          ch.on("broadcast", { event: "live" }, () => setTocchi((prima) => ({ ...prima, [p.gettone]: Date.now() })));
          ch.subscribe();
          return ch;
        })
      : [];
    persone.forEach((p) => void leggi(p.gettone));
    const giro = setInterval(() => persone.forEach((p) => void leggi(p.gettone)), GIRO_MS);
    const orologio = setInterval(() => setAdesso(Date.now()), 5_000);
    return () => {
      clearInterval(giro);
      clearInterval(orologio);
      canali.forEach((ch) => void sb?.removeChannel(ch));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, chiave]);

  const menu = useMemo(() => (listino ? buildMenu(listino) : null), [listino]);

  return (
    <div data-hg-noptr data-hg-sempre className="fixed inset-0 z-[150] flex flex-col bg-[#050f24]/96 p-3 text-white backdrop-blur print:hidden sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-[15px] font-semibold">
          Preventivi in parallelo · {persone.length}
        </h2>
        <span className="text-[12px] text-white/50">si aggiornano mentre compilano</span>
        <button
          type="button"
          onClick={onChiudi}
          aria-label="Chiudi la vista in parallelo"
          className="ml-auto rounded-lg border border-white/15 p-1.5 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {persone.length === 0 ? (
        <p className="m-auto max-w-sm text-center text-[13px] text-white/60">
          Nessuno ha il suo preventivo acceso. Accendilo dal pannello «Cosa vede ciascuno»
          scegliendo «Il suo» accanto al nome.
        </p>
      ) : (
        <div className="grid min-h-0 flex-1 auto-rows-min gap-3 overflow-y-auto [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {persone.map((p) => {
            const s = stati[p.gettone];
            const sc = menu ? schedaDelPreventivo(s, menu) : null;
            const a = attivita(tocchi[p.gettone] || 0, adesso);
            return (
              <div key={p.gettone} className="flex flex-col rounded-2xl border border-white/12 bg-white/[0.04] p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand/25 text-[12px] font-bold text-brand">
                    {p.nome.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate text-[14px] font-semibold">{p.nome}</span>
                  <span className={`ml-auto flex items-center gap-1 text-[11px] ${a.vivo ? "text-emerald-300" : "text-white/45"}`}>
                    <span className={`h-2 w-2 rounded-full ${a.vivo ? "bg-emerald-400 motion-safe:animate-pulse" : "bg-white/25"}`} />
                    {a.testo}
                  </span>
                </div>

                <div className="mt-2.5 min-h-[88px] text-[13px]">
                  {!sc ? (
                    <p className="text-white/45">Carico il listino…</p>
                  ) : sc.vuoto ? (
                    <p className="text-white/45">Non ha ancora scelto una soluzione.</p>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold">{sc.soluzione || "—"}</span>
                        {sc.quantita > 1 && <span className="text-white/60">× {sc.quantita}</span>}
                      </div>
                      {sc.voci.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-[12px] text-white/75">
                          {sc.voci.slice(0, 6).map((v) => (
                            <li key={v} className="truncate">+ {v}</li>
                          ))}
                          {sc.voci.length > 6 && <li className="text-white/45">e altre {sc.voci.length - 6}</li>}
                        </ul>
                      )}
                      {sc.applicazione && <p className="mt-1 text-[12px] text-white/60">Applicazione: {sc.applicazione}</p>}
                      {sc.codice && <p className="mt-1 text-[12px] text-emerald-300">Codice {sc.codice}</p>}
                    </>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-2 border-t border-white/10 pt-2">
                  {sc && !sc.vuoto && (
                    <span className="text-[15px] font-semibold tabular-nums">
                      {formatPrice(sc.totale)}
                      <span className="ml-1 text-[10.5px] font-normal text-white/45">
                        {sc.esatto ? "totale" : "stima"}
                      </span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onIntervieni(p)}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand px-2.5 py-1.5 text-[12px] font-semibold hover:brightness-110"
                  >
                    <PenLine className="h-3.5 w-3.5" /> Intervieni
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
