import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, Search, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { combaciaRicerca, ordinaPerStelle, passaFiltro } from "./cercaChat";
import { useStelle } from "./useStelle";
import { useCRM } from "@/crm/CRMContext";
import { RigaChat, type ModoRiga } from "./RigaChat";
import { ordinaPerScadenza } from "./segniRiga";
import { LEAD_STATUS_LABEL } from "@/crm/types";
import {
  contaPerStato,
  eFiltroPerStato,
  FILTRO_PER_STATO,
  filtroDelloStato,
  vociConScelto,
} from "./perStato";
import {
  chatDaChiamare,
  contaSottofiltri,
  STATI_SOTTOFILTRI,
  type Sottofiltro,
} from "./daChiamare";
import type { ChatItem, ElencoChatProps, FiltroChat } from "./tipi";
import { chiaveOrdine, passaRichiamo, vociFiltro, type FiltroRichiamo } from "./richiamo";
import { oggiIso } from "@/crm/ui";

const FILTRI: { v: FiltroChat; l: string }[] = [
  { v: "all", l: "Tutte" },
  { v: "da-chiamare", l: "Da chiamare" },
  //  I lead in «Attesa WhatsApp» (30/10/2026): vedi `passaFiltro`.
  { v: "attesa-whatsapp", l: "Attesa WhatsApp" },
  //  I lead in «Per ora no» (30/10/2026): vedi `passaFiltro`.
  { v: "per-ora-no", l: "Per ora no" },
  //  Chi ha lasciato l'acconto, in qualunque stato sia (30/10/2026): vedi `passaFiltro`.
  { v: "acconto", l: "Acconto" },
  { v: "unread", l: "Non letti" },
  { v: "with-lead", l: "Con lead" },
  { v: "unknown", l: "Sconosciuti" },
  //  Solo i lead con l'appuntamento fissato (29/10/2026): vedi `passaFiltro`.
  { v: "chiuso-24h", l: "Chiuso 24h" },
  { v: "aperto-24h", l: "24h aperto" },
];

/** I chip dei sottofiltri (con la pillola «Da chiamare» accesa): «Tutti» + uno per stato. */
const CHIP_SOTTOFILTRI: { v: Sottofiltro; l: string }[] = [
  { v: "tutti", l: "Tutti" },
  ...STATI_SOTTOFILTRI.map((v) => ({ v, l: LEAD_STATUS_LABEL[v] })),
];

/** Una fila di pastiglie che scorre di lato: niente barra, aggancio morbido alle
 *  pastiglie, bordo destro sfumato (si vede che continua). */
const FILA =
  "flex snap-x gap-2 overflow-x-auto overscroll-x-contain scroll-px-3 px-3 [mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)] [scrollbar-width:none] md:gap-1.5 md:scroll-px-2 md:px-2 md:py-1 [&::-webkit-scrollbar]:hidden";
/** Il tasto di una pastiglia: 44 px di tocco sul telefono (h-11), 28 dal computer. */
const TASTO = "group h-11 shrink-0 snap-start focus-visible:outline-none md:h-7";
/** La pastiglia a vista: 32 px sul telefono; `accesa` = i colori quando è scelta. */
const pastiglia = (accesa: string | false) =>
  cn(
    "inline-flex h-8 items-center whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring md:h-7 md:px-2.5 md:text-[11px]",
    accesa || "border-border bg-background text-muted-foreground group-hover:bg-muted",
  );

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
      Un interruttore in più fra le pastiglie: mostra, in ogni riquadro, solo le
      chat con stelle. Le stelle ordinano sempre: prima le tre. */
  const { di: stelleDi, cambia: cambiaStelle } = useStelle();
  const [soloStelle, setSoloStelle] = useState(false);
  //  Il sottofiltro della pillola «Da chiamare» (28/10/2026): UN elenco, ordinato per stato.
  const [sotto, setSotto] = useState<Sottofiltro>("tutti");
  //  Quando richiamarlo (29/10/2026): Scaduti, Oggi, Domani, poi le date.
  const [quando, setQuando] = useState<FiltroRichiamo>("tutti");
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
  //  ── FINESTRA IN SCADENZA IN CIMA (30/10/2026) ──────────────────────────
  //  Nella pastiglia «24h aperto» le chat che chiudono entro 4 ore hanno un riquadro tutto
  //  loro, sopra «Da rispondere», dalla scadenza più vicina: si scrive gratis finché si può.
  //  Escono dagli altri riquadri (una chat una volta sola). Vedi segniRiga.ts.
  const inScadenza =
    filtro === "aperto-24h"
      ? ordinaPerScadenza(
          perRicerca(api.chats).filter(
            (c) =>
              delConsulente(c) && passaFiltro(c, filtro) && (!soloStelle || stelleDi(c.phone) > 0),
          ),
          adesso,
        )
      : [];
  const inScadenzaTel = new Set(inScadenza.map((c) => c.phone));
  const perPastiglia = (righe: ChatItem[]) =>
    righe.filter(
      (c) =>
        passaFiltro(c, filtro) &&
        (!soloStelle || stelleDi(c.phone) > 0) &&
        !inScadenzaTel.has(c.phone),
    );
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
  const altreTutte = visibili.filter(
    (c) => !giaSopra.has(c.phone) && !inScadenzaTel.has(c.phone) && delConsulente(c),
  );
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
  /** Quanti per pastiglia (finestra chiusa / aperta, attesa WhatsApp, per ora no, acconto), di quel consulente. */
  const contaFinestra = (
    f: "chiuso-24h" | "aperto-24h" | "attesa-whatsapp" | "per-ora-no" | "acconto",
  ) => api.chats.filter((c) => delConsulente(c) && passaFiltro(c, f)).length;
  /*  ── UN FILTRO PER OGNI STATO DEL LEAD (30/10/2026) ───────────────────
      Richiesta del titolare, in fondo alle pastiglie: «Per stato» apre una fila di chip
      (come quella di «Da chiamare») con gli stati che hanno almeno una chat, nell'ordine
      del CRM. Il numero segue il consulente scelto. Lo stato scelto resta in fila anche
      se intanto si svuota: il filtro non resta mai acceso senza vedersi. */
  const perStatoAperto = eFiltroPerStato(filtro) && !soloStelle;
  const contiStato = contaPerStato(api.chats.filter(delConsulente));
  const chipStato = vociConScelto(contiStato.voci, filtro);
  //  Un chip scelto che nel frattempo si svuota (stato cambiato dalla riga) torna a «Tutti».
  const sottoAttivo: Sottofiltro = sotto === "tutti" || conti[sotto] > 0 ? sotto : "tutti";
  const perStato = chatDaChiamare(daChiamareTutte, sottoAttivo);
  /*  ── QUANDO RICHIAMARLO (29/10/2026) ───────────────────────────────────
      Richiesta del titolare: «devo avere il filtro di quando richiamarlo, oggi,
      domani ecc. con le date». Le voci si contano sulle chat del chip scelto;
      una voce scelta che si svuota torna a «Tutti». Con una voce scelta
      l'elenco va per data e ora del richiamo (prima gli scaduti). */
  const oggi = oggiIso(new Date(adesso));
  const vociQuando = vociFiltro(
    perStato.map((c) => c.lead?.data),
    oggi,
  );
  const quandoAttivo: FiltroRichiamo = vociQuando.some((x) => x.v === quando) ? quando : "tutti";
  const elencoDaChiamare =
    quandoAttivo === "tutti"
      ? perStato
      : perStato
          .filter((c) => passaRichiamo(c.lead?.data, quandoAttivo, oggi))
          .sort((a, b) => chiaveOrdine(a.lead?.data).localeCompare(chiaveOrdine(b.lead?.data)));

  const riga = (
    c: ChatItem,
    modo: ModoRiga,
    mostraFinestra = filtro === "chiuso-24h" || filtro === "aperto-24h",
  ) => (
    <RigaChat
      mostraFinestra={mostraFinestra}
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

      {/*  ── LE FILE DI PASTIGLIE (29/10/2026) ───────────────────────────────
          Scorrono di lato come su WhatsApp, senza barra. Il bordo destro sfuma
          (si capisce che ce ne sono altre) e in fondo c'è un margine, così
          l'ultima arrivata al bordo si legge intera. Il tocco resta da 44 px
          (`TASTO`), la pastiglia a vista è da 32 (`pastiglia`). */}
      <div role="group" aria-label="Filtra le chat" className={cn(FILA, "border-b border-border")}>
        {FILTRI.map((f) => (
          <button
            key={f.v}
            type="button"
            aria-pressed={filtro === f.v && !soloStelle}
            onClick={() => {
              setFiltro(f.v);
              setSoloStelle(false);
            }}
            className={TASTO}
          >
            <span
              className={pastiglia(
                filtro === f.v &&
                  !soloStelle &&
                  "border-emerald-200 bg-emerald-50 text-emerald-700",
              )}
            >
              {f.l}
              {f.v === "da-chiamare" && contaPillola > 0 ? ` ${contaPillola}` : ""}
              {(f.v === "chiuso-24h" ||
                f.v === "aperto-24h" ||
                f.v === "attesa-whatsapp" ||
                f.v === "per-ora-no" ||
                f.v === "acconto") &&
              contaFinestra(f.v) > 0
                ? ` ${contaFinestra(f.v)}`
                : ""}
            </span>
          </button>
        ))}
        <button
          type="button"
          aria-pressed={soloStelle}
          //  ── UNA PASTIGLIA COME LE ALTRE (29/10/2026) ─────────────────────
          //  Guasto: con «Sconosciuti» acceso «In osservazione 2» mostrava un
          //  elenco vuoto (i filtri si sommavano, il numero no). Accenderla
          //  mostra TUTTE le chat con stelle; un'altra pastiglia la spegne.
          onClick={() => {
            if (!soloStelle) setFiltro("all");
            setSoloStelle((v) => !v);
          }}
          className={TASTO}
        >
          <span className={pastiglia(soloStelle && "border-amber-300 bg-amber-50 text-amber-800")}>
            <Star aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
            In osservazione{conStelle ? ` ${conStelle}` : ""}
          </span>
        </button>
        {/*  Per stato (30/10/2026): in fondo, stessa pastiglia delle altre. Riprenderla la chiude. */}
        <button
          type="button"
          aria-pressed={perStatoAperto}
          onClick={() => {
            setSoloStelle(false);
            setFiltro(eFiltroPerStato(filtro) ? "all" : FILTRO_PER_STATO);
          }}
          className={TASTO}
        >
          <span
            className={pastiglia(
              perStatoAperto && "border-emerald-200 bg-emerald-50 text-emerald-700",
            )}
          >
            Per stato{contiStato.tutti > 0 ? ` ${contiStato.tutti}` : ""}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "ml-1 h-3.5 w-3.5 transition-transform",
                perStatoAperto && "rotate-180",
              )}
            />
          </span>
        </button>
        <span aria-hidden="true" className="w-6 shrink-0" />
      </div>

      {perStatoAperto &&
        (chipStato.length === 0 ? (
          <p className="border-b border-border bg-muted/30 px-3 py-2.5 text-[13px] text-muted-foreground md:px-2 md:text-[12px]">
            {consulente
              ? "Nessuna chat di questo consulente ha uno stato."
              : "Nessuna chat ha ancora uno stato."}
          </p>
        ) : (
          <div
            role="group"
            aria-label="Quale stato del lead"
            className={cn(FILA, "border-b border-border bg-muted/30")}
          >
            <button
              type="button"
              aria-pressed={filtro === FILTRO_PER_STATO}
              onClick={() => setFiltro(FILTRO_PER_STATO)}
              className={TASTO}
            >
              <span
                className={pastiglia(
                  filtro === FILTRO_PER_STATO && "border-sky-300 bg-sky-50 text-sky-800",
                )}
              >
                Tutti <span className="ml-1 tabular-nums">{contiStato.tutti}</span>
              </span>
            </button>
            {chipStato.map((v) => (
              <button
                key={v.stato}
                type="button"
                aria-pressed={filtro === filtroDelloStato(v.stato)}
                onClick={() => setFiltro(filtroDelloStato(v.stato))}
                className={TASTO}
              >
                <span
                  className={pastiglia(
                    filtro === filtroDelloStato(v.stato) && "border-sky-300 bg-sky-50 text-sky-800",
                  )}
                >
                  {v.etichetta} <span className="ml-1 tabular-nums">{v.n}</span>
                </span>
              </button>
            ))}
            <span aria-hidden="true" className="w-6 shrink-0" />
          </div>
        ))}

      {filtro === "da-chiamare" && (
        <div
          role="group"
          aria-label="Quale stato di chiamata"
          className={cn(FILA, "border-b border-border bg-muted/30")}
        >
          {CHIP_SOTTOFILTRI.filter((x) => x.v === "tutti" || conti[x.v] > 0).map((x) => (
            <button
              key={x.v}
              type="button"
              aria-pressed={sottoAttivo === x.v}
              onClick={() => setSotto(x.v)}
              className={TASTO}
            >
              <span
                className={pastiglia(
                  sottoAttivo === x.v && "border-sky-300 bg-sky-50 text-sky-800",
                )}
              >
                {x.l} <span className="ml-1 tabular-nums">{conti[x.v]}</span>
              </span>
            </button>
          ))}
          <span aria-hidden="true" className="w-6 shrink-0" />
        </div>
      )}
      {filtro === "da-chiamare" && vociQuando.length > 1 && (
        <label className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-1.5 text-[13px] text-muted-foreground md:px-2 md:text-[12px]">
          <span className="shrink-0">Richiamo</span>
          {/*  Nativa come quella del consulente: sul telefono la rotella di sistema. */}
          <select
            value={quandoAttivo}
            onChange={(e) => setQuando(e.target.value)}
            aria-label="Quando richiamarlo"
            className={cn(
              "h-11 min-w-0 flex-1 rounded-md border bg-background px-2 text-base text-foreground md:h-8 md:text-[13px]",
              quandoAttivo !== "tutti" ? "border-sky-300" : "border-input",
            )}
          >
            {vociQuando.map((x) => (
              <option key={x.v} value={x.v}>
                {`${x.l} (${x.n})`}
              </option>
            ))}
          </select>
        </label>
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
              {elencoDaChiamare.map((c) => riga(c, "normale", true))}
            </ul>
          )
        ) : (
          <>
            {inScadenza.length > 0 && (
              <section aria-labelledby="titolo-in-scadenza">
                <h2
                  id="titolo-in-scadenza"
                  className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-900 md:text-xs"
                >
                  Chiudono presto ({inScadenza.length}) · scrivi ora, è gratis
                </h2>
                <ul>
                  {inScadenza.map((c) => riga(c, c.daRispondere?.attesa ? "attesa" : "normale"))}
                </ul>
              </section>
            )}
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
                    : filtro !== "all" || soloStelle
                      ? "Nessuna in questa vista"
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
                {perStatoAperto ? "Nessuna chat con questo stato" : "Nessuna chat in questa vista"}
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
