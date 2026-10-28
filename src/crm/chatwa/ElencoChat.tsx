import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { combaciaRicerca } from "./cercaChat";
import { useStelle } from "./useStelle";
import { RigaChat, type ModoRiga } from "./RigaChat";
import type { ChatItem, ElencoChatProps, FiltroChat } from "./tipi";

const FILTRI: { v: FiltroChat; l: string }[] = [
  { v: "all", l: "Tutte" },
  { v: "unread", l: "Non letti" },
  { v: "with-lead", l: "Con lead" },
  { v: "unknown", l: "Sconosciuti" },
];

/** Ogni quanto si rinfrescano «da 25 min» e simili (un solo timer per tutto l'elenco). */
const RINFRESCO_MS = 30_000;

/** Chat con risposta mancante da più di 7 giorni (ripiego sui messaggi, D5/R10). */
const eVecchia = (c: ChatItem) => c.daRispondere?.vecchia === true;

/** L'ora «adesso», aggiornata ogni 30 secondi. */
function useAdesso(): number {
  const [adesso, setAdesso] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAdesso(Date.now()), RINFRESCO_MS);
    return () => clearInterval(t);
  }, []);
  return adesso;
}

/** L'elenco delle chat: in cima «Da rispondere», poi le altre, in fondo le senza risposta da
 *  più di 7 giorni. Riempie il contenitore che gli dà `PaginaChat`: larghezza e visibilità
 *  non sono affar suo (R12). Sul telefono è a tutta larghezza: bersagli da 44 px, testi
 *  da 15/13 px (16 px nella ricerca, altrimenti iOS ingrandisce la pagina). */
export function ElencoChat({ api, onCreaScheda, onAbbina }: ElencoChatProps) {
  const { filtro, setFiltro, ricerca, setRicerca, visibili, caricamento, attiva, apri } = api;
  const adesso = useAdesso();
  const [vecchieAperte, setVecchieAperte] = useState(false);
  /*  ── IN OSSERVAZIONE (28/10/2026) ──────────────────────────────────────
      Un interruttore in più fra le pastiglie: mostra fra le «Altre chat» solo
      quelle con stelle, prima le tre. «Da rispondere» resta com'è: chi aspetta
      una risposta non si nasconde con un filtro. */
  const { di: stelleDi, cambia: cambiaStelle } = useStelle();
  const [soloStelle, setSoloStelle] = useState(false);

  // Il riquadro e le «vecchie» obbediscono SOLO alla ricerca, non alle pastiglie: chi aspetta una
  // risposta non si nasconde con un filtro. La ricerca è fatta qui (non da `visibili`, che applica anche la pastiglia).
  const cercando = ricerca.trim() !== "";
  const perRicerca = (righe: ChatItem[]) => righe.filter((c) => combaciaRicerca(c, ricerca));

  const inAttesa = perRicerca(api.daRispondere);
  const vecchie = perRicerca(api.chats.filter(eVecchia));
  // Una chat una volta sola: se sta nel riquadro o fra le «vecchie», non si ripete fra le altre.
  const giaSopra = new Set(
    [...api.daRispondere, ...api.chats.filter(eVecchia)].map((c) => c.phone),
  );
  const altreTutte = visibili.filter((c) => !giaSopra.has(c.phone));
  const altre = soloStelle
    ? altreTutte
        .filter((c) => stelleDi(c.phone) > 0)
        .sort((a, b) => stelleDi(b.phone) - stelleDi(a.phone))
    : altreTutte;
  //  Il numero conta quelle che l'interruttore mostra (le «Altre chat» con stelle).
  const conStelle = altreTutte.filter((c) => stelleDi(c.phone) > 0).length;

  const riga = (c: ChatItem, modo: ModoRiga) => (
    <RigaChat
      key={c.phone}
      chat={c}
      modo={modo}
      attiva={attiva?.phone === c.phone}
      adesso={adesso}
      onApri={() => apri(c.phone)}
      onCreaScheda={() => onCreaScheda(c)}
      onAbbina={() => onAbbina(c)}
      stelle={stelleDi(c.phone)}
      onStelle={() => cambiaStelle(c.phone)}
    />
  );

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-card">
      <div className="px-3 pb-1 pt-3 md:py-2.5">
        <span className="text-[17px] font-semibold text-foreground md:text-[13px]">Chat</span>
      </div>

      <div className="px-3 pb-2 md:px-2 md:py-2">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground md:left-2.5 md:h-3.5 md:w-3.5"
          />
          <Input
            type="search"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca nome o numero…"
            aria-label="Cerca nome o numero"
            className="h-11 bg-background pl-9 text-base md:h-8 md:pl-8 md:text-[13px]"
          />
        </div>
      </div>

      {/* Pastiglie: scorrono di lato, senza barra, e nessuna va a capo */}
      <div
        role="group"
        aria-label="Filtra le chat"
        className="flex gap-2 overflow-x-auto border-b border-border px-3 pb-2.5 [scrollbar-width:none] md:gap-1.5 md:px-2 md:py-2 [&::-webkit-scrollbar]:hidden"
      >
        {FILTRI.map((f) => (
          <button
            key={f.v}
            type="button"
            aria-pressed={filtro === f.v}
            onClick={() => setFiltro(f.v)}
            className={cn(
              "h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-7 md:px-2.5 md:text-[11px]",
              filtro === f.v
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-border bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {f.l}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={soloStelle}
          onClick={() => setSoloStelle((v) => !v)}
          className={cn(
            "h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-7 md:px-2.5 md:text-[11px]",
            soloStelle
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-border bg-background text-muted-foreground hover:bg-muted",
          )}
        >
          ★ In osservazione{conStelle ? ` ${conStelle}` : ""}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {caricamento ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento chat…
          </div>
        ) : (
          <>
            <section aria-labelledby="titolo-da-rispondere">
              <h2
                id="titolo-da-rispondere"
                className={cn(
                  "border-b px-3 py-2 text-[13px] font-semibold md:text-xs",
                  inAttesa.length > 0
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                Da rispondere ({inAttesa.length})
              </h2>
              {inAttesa.length === 0 ? (
                <p className="flex items-center gap-2 border-b border-border px-3 py-3 text-[13px] text-muted-foreground">
                  {!cercando && (
                    <CheckCircle2
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-emerald-600"
                    />
                  )}
                  {cercando ? "Nessuna in questa ricerca" : "Nessuno aspetta una risposta"}
                </p>
              ) : (
                <ul>{inAttesa.map((c) => riga(c, "attesa"))}</ul>
              )}
            </section>

            {visibili.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-muted-foreground">
                Nessuna chat in questa vista
              </p>
            ) : soloStelle && altre.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                Nessuna chat in osservazione: tocca le stelle su una riga.
              </p>
            ) : (
              altre.length > 0 && (
                <section aria-labelledby="titolo-altre-chat">
                  <h2
                    id="titolo-altre-chat"
                    className="border-b border-border bg-muted/40 px-3 py-2 text-[13px] font-semibold text-muted-foreground md:text-xs"
                  >
                    {soloStelle ? "In osservazione" : "Altre chat"}
                  </h2>
                  <ul>{altre.map((c) => riga(c, "normale"))}</ul>
                </section>
              )
            )}

            {vecchie.length > 0 && (
              <section>
                <button
                  type="button"
                  aria-expanded={vecchieAperte}
                  onClick={() => setVecchieAperte((v) => !v)}
                  className="flex min-h-11 w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-[13px] text-muted-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:min-h-9 md:text-xs"
                >
                  <span>{vecchie.length} chat senza risposta da più di 7 giorni</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform",
                      vecchieAperte && "rotate-180",
                    )}
                  />
                </button>
                {vecchieAperte && <ul>{vecchie.map((c) => riga(c, "vecchia"))}</ul>}
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
