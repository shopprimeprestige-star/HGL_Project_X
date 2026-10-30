import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Search, Star, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { combaciaRicerca, ordinaPerStelle } from "./cercaChat";
import { useStelle } from "./useStelle";
import { useCRM } from "@/crm/CRMContext";
import { RigaChat, type ModoRiga } from "./RigaChat";
import { BarraProssimoMeet } from "./BarraProssimoMeet";
import { prossimoMeet } from "./prossimo-meet";
import { ordinaPerScadenza } from "./segniRiga";
import { LEAD_STATUS_LABEL } from "@/crm/types";
import { contaPerStato, vociConScelto } from "./perStato";
import {
  chatDaChiamare,
  contaSottofiltri,
  STATI_SOTTOFILTRI,
  type Sottofiltro,
} from "./daChiamare";
import {
  commuta,
  contaAccesi,
  contaVoce,
  eAcceso,
  etichetteAccese,
  FILTRI_VUOTI,
  filtriValidi,
  passaFiltri,
  togli,
  VOCI_RIGA,
  type CampoFiltro,
} from "./filtri";
import { BORDO_TASTO, Contatore, FUOCO, PannelloFiltri } from "./PannelloFiltri";
import type { ChatItem, ElencoChatProps } from "./tipi";
import { chiaveOrdine, passaRichiamo, vociFiltro, type FiltroRichiamo } from "./richiamo";
import { oggiIso } from "@/crm/ui";

/** I chip dello «Stato della chiamata» (con «Da chiamare» acceso): «Tutti» + uno per stato. */
const CHIP_SOTTOFILTRI: { v: Sottofiltro; l: string }[] = [
  { v: "tutti", l: "Tutti" },
  ...STATI_SOTTOFILTRI.map((v) => ({ v, l: LEAD_STATUS_LABEL[v] })),
];

/** Il tasto di un chip: 44 px di tocco col dito, 32 dal computer col mouse. Il chip a vista
 *  (`chip`) è più basso: il resto è area da toccare, trasparente. */
const TASTO_CHIP =
  "group inline-flex items-center focus-visible:outline-none min-h-11 lg:pointer-fine:min-h-8";
/** Il chip a vista; `acceso` = i colori del secondo livello (primario chiaro). */
const chip = (acceso: boolean) =>
  cn(
    "t-nota inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border px-3 font-medium transition-colors lg:pointer-fine:h-7",
    "group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-primary",
    acceso
      ? "border-primary/40 bg-primary/10 text-[color-mix(in_oklab,var(--primary),black_25%)]"
      : `${BORDO_TASTO} bg-background text-muted-foreground group-hover:bg-muted`,
  );

/** Ogni quanto si rinfrescano «da 25 min» e simili (un solo timer per tutto l'elenco). */
const RINFRESCO_MS = 30_000;

/** L'ora «adesso», aggiornata ogni 30 secondi. */
function useAdesso(): number {
  const [adesso, setAdesso] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAdesso(Date.now()), RINFRESCO_MS);
    return () => clearInterval(t);
  }, []);
  return adesso;
}

/** L'elenco delle chat: in cima «Da rispondere», poi le altre. Riempie il contenitore che gli dà `PaginaChat`: larghezza e visibilità
 *  non sono affar suo (R12). Sul telefono è a tutta larghezza: bersagli da 44 px, testi
 *  della scala `t-*`, 16 px nella ricerca (altrimenti iOS ingrandisce la pagina).
 *
 *  ── I FILTRI A GRUPPI (30/10/2026) ──────────────────────────────────────
 *  Una riga che scorre (Tutte · Da rispondere · Da chiamare · Con stelle · Sconosciuti) e il
 *  tasto «Filtri» col pannello dei sei gruppi. Gruppi diversi si sommano; in uno stesso gruppo
 *  si sceglie una voce sola. Le regole sono in filtri.ts: qui si compongono e si disegnano. */
export function ElencoChat({ api, onCreaScheda, onAbbina }: ElencoChatProps) {
  const { filtri: filtriSalvati, setFiltri, ricerca, setRicerca, caricamento, attiva, apri } = api;
  const adesso = useAdesso();
  const [pannelloAperto, setPannelloAperto] = useState(false);
  //  Le stelle (28/10/2026): ordinano sempre l'elenco, prima le tre; ora sono anche un filtro.
  const { di: stelleDi, cambia: cambiaStelle } = useStelle();
  //  Il sottofiltro di «Da chiamare» (28/10/2026): UN elenco, ordinato per stato.
  const [sotto, setSotto] = useState<Sottofiltro>("tutti");
  //  Quando richiamarlo (29/10/2026): Scaduti, Oggi, Domani, poi le date.
  const [quando, setQuando] = useState<FiltroRichiamo>("tutti");

  /*  ── IL CONSULENTE (28/10/2026) ────────────────────────────────────────
      Le chat dei lead assegnati a un consulente (`consulenteId` della scheda). Vale per TUTTE le
      sezioni, anche «Da rispondere»: è la vista di una persona, non un'etichetta — e quanti
      aspettano negli altri si dice. Fra le scelte i consulenti con almeno una chat, più quello
      scelto (anche se intanto le sue chat sono passate a un altro: il filtro non resta mai acceso
      senza vedersi). Dal 30/10 si ricorda sul dispositivo; se è stato cancellato dal CRM non vale. */
  const { consultants } = useCRM();
  const consulentiNoti = useMemo(() => new Set(consultants.map((x) => x.id)), [consultants]);
  const filtri = useMemo(
    () => filtriValidi(filtriSalvati, consulentiNoti),
    [filtriSalvati, consulentiNoti],
  );
  const consulente = filtri.consulente;
  const nomeConsulente = (id: string) =>
    String(consultants.find((x) => x.id === id)?.data?.nome ?? "").trim() || "Senza nome";
  const accesi = contaAccesi(filtri);
  const cercando = ricerca.trim() !== "";
  //  «Tutte» è acceso quando nessun filtro è attivo (il consulente scelto non conta: si ricorda).
  const soloRiga = contaAccesi({ ...filtri, consulente: "" }) === 0;

  // ── Quante chat con questi filtri, e quanti numeri per ogni voce (ricerca esclusa) ────────
  const passa = (c: ChatItem) => passaFiltri(c, filtri, stelleDi);
  const conta = (campo: CampoFiltro, valore: string | true) =>
    contaVoce(api.chats, filtri, stelleDi, campo, valore);

  // I riquadri obbediscono a ricerca e filtri. «Una chat una volta sola»: sotto.
  const trovate = api.chats.filter((c) => passa(c) && combaciaRicerca(c, ricerca));
  const perStelle = (righe: ChatItem[]) => ordinaPerStelle(righe, stelleDi);
  //  ── FINESTRA IN CHIUSURA IN CIMA (30/10/2026) ───────────────────────────
  //  Con «Si può scrivere» le chat che chiudono entro 4 ore hanno un riquadro tutto loro, sopra
  //  «Da rispondere», dalla scadenza più vicina: si scrive gratis finché si può.
  //  Escono dagli altri riquadri (una chat una volta sola). Vedi segniRiga.ts.
  const inScadenza = filtri.finestra === "aperta" ? ordinaPerScadenza(trovate, adesso) : [];
  const inScadenzaTel = new Set(inScadenza.map((c) => c.phone));
  const fuoriScadenza = trovate.filter((c) => !inScadenzaTel.has(c.phone));

  const inAttesa = perStelle(fuoriScadenza.filter((c) => c.daRispondere?.attesa));
  //  Chi aspetta e non è di questo consulente (ma passa il resto): si dice, non si nasconde nel silenzio.
  const nascostiInAttesa = consulente
    ? api.chats.filter(
        (c) =>
          c.daRispondere?.attesa &&
          !inScadenzaTel.has(c.phone) &&
          combaciaRicerca(c, ricerca) &&
          passaFiltri(c, { ...filtri, consulente: "" }, stelleDi),
      ).length - inAttesa.length
    : 0;
  // Una chat una volta sola: se sta fra quelle che aspettano, non si ripete fra le altre.
  const altre = perStelle(fuoriScadenza.filter((c) => !c.daRispondere?.attesa));

  //  ── «DA CHIAMARE» CON I SOTTOFILTRI (28/10/2026) ──────────────────────
  //  Con «Da chiamare» acceso NON ci sono riquadri: un elenco solo, ordinato per stato (non
  //  risponde, segreteria…) e dentro ogni stato dal cambio più vecchio. I chip scelgono uno stato
  //  solo; quelli a zero spariscono. Ora ubbidisce anche agli altri gruppi (30/10/2026).
  const daChiamareTutte = filtri.coda === "da-chiamare" ? trovate : [];
  const conti = contaSottofiltri(daChiamareTutte);
  //  Un chip scelto che nel frattempo si svuota (stato cambiato dalla riga) torna a «Tutti».
  const sottoAttivo: Sottofiltro = sotto === "tutti" || conti[sotto] > 0 ? sotto : "tutti";
  const perStato = chatDaChiamare(daChiamareTutte, sottoAttivo);
  /*  ── QUANDO RICHIAMARLO (29/10/2026) ───────────────────────────────────
      Le voci si contano sulle chat del chip scelto; una voce scelta che si svuota torna a
      «Tutti». Con una voce scelta l'elenco va per data e ora del richiamo (prima gli scaduti). */
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

  // ── Le voci del pannello che cambiano con i dati ──────────────────────────────────────────
  //  «Altri stati»: gli stati con almeno una chat (con gli altri filtri accesi), più quello scelto.
  const stati = contaPerStato(
    api.chats.filter((c) => passaFiltri(c, { ...filtri, fase: null }, stelleDi)),
  );
  const altriStati = vociConScelto(stati.voci, filtri.fase ?? "").map((v) => ({
    stato: v.stato,
    nome: v.etichetta,
    n: conta("fase", `stato:${v.stato}`),
  }));
  //  Consulenti: quelli con almeno una chat, più lo scelto.
  const conChat = new Set(api.chats.map((c) => c.lead?.data?.consulenteId).filter(Boolean));
  const consulenti = consultants
    .filter((x) => conChat.has(x.id) || x.id === consulente)
    .map((x) => ({ id: x.id, nome: nomeConsulente(x.id), n: conta("consulente", x.id) }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const etichette = etichetteAccese(filtri, nomeConsulente);
  const azzera = () => setFiltri(FILTRI_VUOTI);

  /*  ── IL PROSSIMO MEET IN CIMA (30/10/2026) ──────────────────────────────
      Fra le chat che passano filtri e ricerca (con il filtro consulente è il prossimo meet di quella
      persona). Sta in una barra incollata sopra tutte le sezioni e NON esce dalla sua sezione: i
      numeri di «Da rispondere» devono restare quelli del pulsante, e una chat che sparisce da lì
      sembrerebbe già risposta. In sezione la riga ha solo il segno viola. Si aggiorna col timer. */
  //  In «Da chiamare» si guarda l'elenco mostrato: mai un meet la cui riga non c'è.
  const meet = prossimoMeet(
    filtri.coda === "da-chiamare" ? elencoDaChiamare : trovate,
    oggi,
    adesso,
    consultants,
  );

  const riga = (c: ChatItem, modo: ModoRiga, mostraFinestra = filtri.finestra !== null) => (
    <RigaChat
      prossimoMeet={meet?.chat.phone === c.phone}
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

  /** Tutto l'elenco è vuoto: si dice perché e, con dei filtri accesi, c'è il tasto per toglierli. */
  const vuoto = (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <p className="t-nota text-muted-foreground">
        {filtri.coda === "da-chiamare" && accesi === 1 && !cercando
          ? "Nessuno da chiamare: tutto in ordine"
          : accesi > 0
            ? "Nessuna chat con questi filtri"
            : cercando
              ? "Nessuna chat trovata"
              : "Nessuna chat"}
      </p>
      {accesi > 0 && (
        <button
          type="button"
          onClick={azzera}
          className={cn(
            "t-corpo inline-flex items-center rounded-md border bg-background px-3 font-medium hover:bg-muted",
            BORDO_TASTO,
            "h-11 lg:pointer-fine:h-8",
            FUOCO,
          )}
        >
          Azzera filtri
        </button>
      )}
    </div>
  );

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-card">
      <div className="px-3 pb-1 pt-3 md:px-2 md:py-2.5">
        {/*  Il titolo dice cosa si sta guardando: con nessun filtro, tutte (la pastiglia «Tutte» non c'è più). */}
        <p className="t-riga font-semibold text-foreground">
          {accesi > 0 ? "Chat filtrate" : "Tutte le chat"}
          {!caricamento && (
            <span className="tabular-nums text-muted-foreground">
              {" · "}
              {accesi > 0 ? trovate.length : api.chats.length}
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 px-3 pb-2 md:px-2">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground lg:pointer-fine:left-2.5 lg:pointer-fine:h-3.5 lg:pointer-fine:w-3.5"
          />
          <Input
            type="search"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca nome o numero…"
            aria-label="Cerca nome o numero"
            className="h-11 bg-background pl-9 text-base focus-visible:ring-2 focus-visible:ring-primary md:text-base lg:pointer-fine:h-8 lg:pointer-fine:pl-8 lg:pointer-fine:text-[13px]"
          />
        </div>
        <PannelloFiltri
          filtri={filtri}
          onCambia={setFiltri}
          conta={conta}
          altriStati={altriStati}
          consulenti={consulenti}
          mostra={trovate.length}
          aperto={pannelloAperto}
          onApri={setPannelloAperto}
        />
      </div>

      {/*  ── LA RIGA DEI FILTRI RAPIDI (30/10/2026) ──────────────────────────
          Una riga sola che scorre di lato (sul telefono si scorre col dito), nell'ordine d'uso:
          Tutte · Da rispondere · Da chiamare · Con stelle · Sconosciuti. Tasti alti 44 px, nomi corti.
          Acceso = pieno primario E `aria-pressed` (il colore non basta da solo). Il numero è quello
          che vedrai se tocchi. «Tutte» spegne i filtri ma non il consulente, che si ricorda. */}
      <div
        role="group"
        aria-label="Filtri rapidi"
        className="flex gap-2 overflow-x-auto overscroll-x-contain px-3 pb-2 [scrollbar-width:none] md:px-2 [&::-webkit-scrollbar]:hidden"
      >
        <button
          type="button"
          aria-pressed={soloRiga}
          onClick={() => setFiltri({ ...FILTRI_VUOTI, consulente: filtri.consulente })}
          className={cn(
            "t-corpo flex h-11 shrink-0 items-center rounded-lg border px-3 font-medium transition-colors lg:pointer-fine:h-8",
            soloRiga
              ? "border-primary bg-primary text-primary-foreground"
              : `${BORDO_TASTO} bg-background text-foreground hover:bg-muted`,
            FUOCO,
          )}
        >
          Tutte
        </button>
        {VOCI_RIGA.map((v) => {
          const acceso = eAcceso(filtri, v.campo, v.valore);
          return (
            <button
              key={`${v.campo}:${String(v.valore)}`}
              type="button"
              aria-pressed={acceso}
              onClick={() => setFiltri(commuta(filtri, v.campo, v.valore))}
              className={cn(
                "t-corpo flex h-11 shrink-0 items-center gap-1.5 rounded-lg border px-3 font-medium transition-colors lg:pointer-fine:h-8",
                acceso
                  ? "border-primary bg-primary text-primary-foreground"
                  : `${BORDO_TASTO} bg-background text-foreground hover:bg-muted`,
                FUOCO,
              )}
            >
              {v.campo === "stelle" && (
                <Star
                  aria-hidden="true"
                  className={cn("h-3.5 w-3.5 shrink-0", acceso ? "text-amber-300" : "text-amber-600")}
                />
              )}
              <span className="whitespace-nowrap">{v.nome}</span>
              <Contatore
                n={conta(v.campo, v.valore)}
                acceso={acceso}
                urgente={v.valore === "da-rispondere"}
              />
            </button>
          );
        })}
      </div>

      {/*  Il riepilogo: mai un filtro acceso che non si vede. Ogni etichetta si toglie con la sua ✕. */}
      {accesi > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 border-t border-border px-3 md:px-2">
          <p className="t-nota tabular-nums text-muted-foreground">
            {trovate.length} di {api.chats.length} chat
          </p>
          <button
            type="button"
            onClick={azzera}
            className={cn(
              "t-nota inline-flex items-center rounded-md px-1 font-medium text-primary underline-offset-2 hover:underline",
              "min-h-11 lg:pointer-fine:min-h-8",
              FUOCO,
            )}
          >
            Azzera
          </button>
          {etichette.map((e) => (
            <button
              key={e.campo}
              type="button"
              aria-label={`Togli il filtro ${e.etichetta}`}
              onClick={() => setFiltri(togli(filtri, e.campo))}
              className={TASTO_CHIP}
            >
              <span className={chip(true)}>
                {e.etichetta}
                <X aria-hidden="true" className="h-3 w-3 shrink-0" />
              </span>
            </button>
          ))}
        </div>
      )}

      {/*  Sotto «Da chiamare»: lo stato della chiamata e quando richiamare. Vanno a capo, non scorrono. */}
      {filtri.coda === "da-chiamare" && (
        <div className="flex flex-col border-y border-border bg-muted/30 px-3 py-1 md:px-2">
          <div
            role="group"
            aria-label="Stato della chiamata"
            className="flex flex-wrap items-center gap-x-1.5"
          >
            <span className="t-nota mr-1 text-muted-foreground">Stato della chiamata</span>
            {CHIP_SOTTOFILTRI.filter((x) => x.v === "tutti" || conti[x.v] > 0).map((x) => (
              <button
                key={x.v}
                type="button"
                aria-pressed={sottoAttivo === x.v}
                onClick={() => setSotto(x.v)}
                className={TASTO_CHIP}
              >
                <span className={chip(sottoAttivo === x.v)}>
                  {x.l} <span className="tabular-nums">{conti[x.v]}</span>
                </span>
              </button>
            ))}
          </div>
          {vociQuando.length > 1 && (
            <label className="t-nota flex items-center gap-2 py-1 text-muted-foreground">
              <span className="shrink-0">Quando richiamare</span>
              {/*  Nativa come quella del consulente: sul telefono la rotella di sistema. «Scaduti» in rosso. */}
              <select
                value={quandoAttivo}
                onChange={(e) => setQuando(e.target.value)}
                className={cn(
                  "h-11 min-w-0 flex-1 rounded-md border bg-background px-2 text-base lg:pointer-fine:h-8 lg:pointer-fine:text-[13px]",
                  quandoAttivo === "scaduti"
                    ? "border-red-700 text-red-700"
                    : quandoAttivo !== "tutti"
                      ? "border-primary text-primary"
                      : `${BORDO_TASTO} text-foreground`,
                  FUOCO,
                )}
              >
                {vociQuando.map((x) => (
                  <option
                    key={x.v}
                    value={x.v}
                    className={x.v === "scaduti" ? "text-red-700" : undefined}
                  >
                    {`${x.l} (${x.n})`}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {/*  Per chi usa lo screen reader: a ogni cambio, quante chat si vedono. */}
      <div role="status" aria-live="polite" className="sr-only">
        {caricamento ? "" : `${trovate.length} chat`}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border">
        {!caricamento && meet && (
          <BarraProssimoMeet meet={meet} onApri={() => apri(meet.chat.phone)} />
        )}
        {caricamento ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento chat…
          </div>
        ) : trovate.length === 0 ? (
          vuoto
        ) : filtri.coda === "da-chiamare" ? (
          elencoDaChiamare.length === 0 ? (
            vuoto
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
                  className="t-corpo border-b border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-900"
                >
                  Finestra in chiusura ({inScadenza.length}) · scrivi ora, è gratis
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
                  "t-corpo border-b px-3 py-2 font-semibold",
                  inAttesa.length > 0
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                Da rispondere ({inAttesa.length})
                {nascostiInAttesa > 0
                  ? ` · altre ${nascostiInAttesa} non di questo consulente`
                  : ""}
              </h2>
              {inAttesa.length === 0 ? (
                <p className="t-nota flex items-center gap-2 border-b border-border px-3 py-3 text-muted-foreground">
                  {accesi === 0 && !cercando && (
                    <CheckCircle2
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                    />
                  )}
                  {cercando
                    ? "Nessuna in questa ricerca"
                    : accesi > 0
                      ? "Nessuna con questi filtri"
                      : "Nessuno aspetta una risposta"}
                </p>
              ) : (
                <ul>{inAttesa.map((c) => riga(c, "attesa"))}</ul>
              )}
            </section>

            {altre.length > 0 && (
              <section aria-labelledby="titolo-altre-chat">
                <h2
                  id="titolo-altre-chat"
                  className="t-corpo border-b border-border bg-muted/40 px-3 py-2 font-semibold text-muted-foreground"
                >
                  {filtri.stelle ? "Con stelle" : "Altre chat"}
                </h2>
                <ul>{altre.map((c) => riga(c, "normale"))}</ul>
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
