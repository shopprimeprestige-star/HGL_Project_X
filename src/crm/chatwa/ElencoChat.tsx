import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { combaciaRicerca, ordinaPerStelle, passaFiltro } from "./cercaChat";
import { useStelle } from "./useStelle";
import { useCRM } from "@/crm/CRMContext";
import { RigaChat, type ModoRiga } from "./RigaChat";
import { LEAD_STATUS_LABEL } from "@/crm/types";
import {
  chatDaChiamare,
  contaSottofiltri,
  STATI_SOTTOFILTRI,
  type Sottofiltro,
} from "./daChiamare";
import type { ChatItem, ElencoChatProps, FiltroChat } from "./tipi";

const FILTRI: { v: FiltroChat; l: string }[] = [
  { v: "all", l: "Tutte" },
  { v: "da-chiamare", l: "Da chiamare" },
  { v: "unread", l: "Non letti" },
  { v: "with-lead", l: "Con lead" },
  { v: "unknown", l: "Sconosciuti" },
];

/** I chip dei sottofiltri (con la pillola «Da chiamare» accesa): «Tutti» + uno per stato. */
const CHIP_SOTTOFILTRI: { v: Sottofiltro; l: string }[] = [
  { v: "tutti", l: "Tutti" },
  ...STATI_SOTTOFILTRI.map((v) => ({ v, l: LEAD_STATUS_LABEL[v] })),
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
      quelle con stelle, prima le tre. «Da rispondere» non lo tocca: chi aspetta
      una risposta non si nasconde con le stelle (il consulente sì, qui sotto). */
  const { di: stelleDi, cambia: cambiaStelle } = useStelle();
  const [soloStelle, setSoloStelle] = useState(false);
  //  Il sottofiltro della pillola «Da chiamare» (28/10/2026): UN elenco, ordinato per stato.
  const [sotto, setSotto] = useState<Sottofiltro>("tutti");
  /*  ── IL FILTRO DEL CONSULENTE (28/10/2026) ─────────────────────────────
      Richiesta del titolare: le chat dei lead assegnati a un consulente (che ha
      fatto o ha in programma la consulenza con lui: `consulenteId` della
      scheda). Vale per TUTTE le sezioni, anche «Da rispondere»: è la vista di
      una persona, non un'etichetta — e quanti aspettano negli altri si dice.
      Fra le scelte i consulenti con almeno una chat, più quello scelto (anche
      se intanto le sue chat sono passate a un altro: il filtro non resta mai
      acceso senza vedersi). */
  const { consultants } = useCRM();
  const [consulente, setConsulente] = useState("");
  const delConsulente = (c: ChatItem) => !consulente || c.lead?.data?.consulenteId === consulente;
  const conChat = new Set(api.chats.map((c) => c.lead?.data?.consulenteId).filter(Boolean));
  const sceltaConsulenti = consultants
    .filter((x) => conChat.has(x.id) || x.id === consulente)
    .map((x) => ({ id: x.id, nome: String(x.data?.nome ?? "").trim() || "Senza nome" }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // I riquadri obbediscono a ricerca, consulente e pastiglia. La ricerca è fatta qui (non da `visibili`, che applica anche la pastiglia).
  const cercando = ricerca.trim() !== "";
  const perRicerca = (righe: ChatItem[]) => righe.filter((c) => combaciaRicerca(c, ricerca));
  //  La pastiglia vale per TUTTI i riquadri (guasto del 28/10: li ignorava e l'elenco non cambiava).
  //  Anche «In osservazione» (le chat con stelle) vale per tutti i riquadri, e in ognuno le
  //  chat con più stelle salgono in cima (`perStelle`): a parità resta l'ordine del riquadro.
  const perPastiglia = (righe: ChatItem[]) =>
    righe.filter((c) => passaFiltro(c, filtro) && (!soloStelle || stelleDi(c.phone) > 0));
  const perStelle = (righe: ChatItem[]) => ordinaPerStelle(righe, stelleDi);

  const inAttesaTutti = perPastiglia(perRicerca(api.daRispondere));
  const inAttesa = perStelle(inAttesaTutti.filter(delConsulente));
  const nascostiInAttesa = inAttesaTutti.length - inAttesa.length;
  const vecchie = perStelle(
    perPastiglia(perRicerca(api.chats.filter(eVecchia))).filter(delConsulente),
  );
  // Una chat una volta sola: se sta nel riquadro o fra le «vecchie», non si ripete fra le altre.
  const giaSopra = new Set(
    [...api.daRispondere, ...api.chats.filter(eVecchia)].map((c) => c.phone),
  );
  const altreTutte = visibili.filter((c) => !giaSopra.has(c.phone) && delConsulente(c));
  const altre = perStelle(
    soloStelle ? altreTutte.filter((c) => stelleDi(c.phone) > 0) : altreTutte,
  );
  //  Il numero conta TUTTE le chat con stelle (di quel consulente), in qualunque riquadro.
  const conStelle = api.chats.filter((c) => delConsulente(c) && stelleDi(c.phone) > 0).length;
  const nienteInOsservazione = soloStelle && inAttesa.length + vecchie.length + altre.length === 0;

  //  ── «DA CHIAMARE» CON I SOTTOFILTRI (28/10/2026) ──────────────────────
  //  Con la pillola accesa NON ci sono riquadri: un elenco solo, ordinato per stato
  //  (non risponde, segreteria…) e dentro ogni stato dal cambio più vecchio. I chip
  //  scelgono uno stato solo; quelli a zero spariscono. Sostituisce la vecchia fascia
  //  «Da chiamare (N) · in attesa da oltre 10 ore»: il numero della pillola è questo.
  const daChiamareTutte = perPastiglia(perRicerca(api.chats)).filter(delConsulente);
  const conti = contaSottofiltri(daChiamareTutte);
  const contaPillola = contaSottofiltri(api.chats.filter(delConsulente)).tutti;
  //  Un chip scelto che nel frattempo si svuota (stato cambiato dalla riga) torna a «Tutti».
  const sottoAttivo: Sottofiltro = sotto === "tutti" || conti[sotto] > 0 ? sotto : "tutti";
  const elencoDaChiamare = chatDaChiamare(daChiamareTutte, sottoAttivo);

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
      onCambiaStato={(lead, stato) => void api.cambiaStatoLead(lead, stato)}
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
        {sceltaConsulenti.length > 0 && (
          <label className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground md:text-[12px]">
            <span className="shrink-0">Consulente</span>
            {/*  Nativa: sul telefono apre la rotella di sistema, che col pollice è
                la più comoda. 16 px sul telefono, altrimenti iOS ingrandisce. */}
            <select
              value={consulente}
              onChange={(e) => setConsulente(e.target.value)}
              className={cn(
                "h-11 min-w-0 flex-1 rounded-md border bg-background px-2 text-base text-foreground md:h-8 md:text-[13px]",
                consulente ? "border-emerald-300" : "border-input",
              )}
            >
              <option value="">Tutti</option>
              {sceltaConsulenti.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nome}
                </option>
              ))}
            </select>
          </label>
        )}
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
            {f.v === "da-chiamare" && contaPillola > 0 ? ` ${contaPillola}` : ""}
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

      {filtro === "da-chiamare" && (
        <div
          role="group"
          aria-label="Quale stato di chiamata"
          className="flex gap-2 overflow-x-auto border-b border-border bg-muted/30 px-3 py-2 [scrollbar-width:none] md:gap-1.5 md:px-2 [&::-webkit-scrollbar]:hidden"
        >
          {CHIP_SOTTOFILTRI.filter((x) => x.v === "tutti" || conti[x.v] > 0).map((x) => (
            <button
              key={x.v}
              type="button"
              aria-pressed={sotto === x.v}
              onClick={() => setSotto(x.v)}
              className={cn(
                "h-10 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-7 md:px-2.5 md:text-[11px]",
                sottoAttivo === x.v
                  ? "border-sky-300 bg-sky-50 text-sky-800"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {x.l} {conti[x.v]}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {caricamento ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento chat…
          </div>
        ) : filtro === "da-chiamare" ? (
          elencoDaChiamare.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">
              {cercando || consulente || soloStelle
                ? "Nessuna chat da chiamare in questa vista"
                : "Nessuno da chiamare: tutto in ordine"}
            </p>
          ) : (
            <ul aria-label="Chat da chiamare, per stato">
              {elencoDaChiamare.map((c) => riga(c, "normale"))}
            </ul>
          )
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
                Da rispondere ({inAttesa.length}
                {nascostiInAttesa > 0 ? ` · altri ${nascostiInAttesa} in attesa` : ""})
              </h2>
              {inAttesa.length === 0 ? (
                <p className="flex items-center gap-2 border-b border-border px-3 py-3 text-[13px] text-muted-foreground">
                  {!cercando && (
                    <CheckCircle2
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-emerald-600"
                    />
                  )}
                  {cercando
                    ? "Nessuna in questa ricerca"
                    : consulente
                      ? "Nessun cliente di questo consulente aspetta una risposta"
                      : "Nessuno aspetta una risposta"}
                </p>
              ) : (
                <ul>{inAttesa.map((c) => riga(c, "attesa"))}</ul>
              )}
            </section>

            {visibili.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-muted-foreground">
                Nessuna chat in questa vista
              </p>
            ) : consulente && altre.length === 0 && !soloStelle ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                Nessun'altra chat di questo consulente.
              </p>
            ) : nienteInOsservazione ? (
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
