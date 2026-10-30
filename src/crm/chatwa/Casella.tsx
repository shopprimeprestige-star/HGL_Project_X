import { useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  CalendarClock,
  Clock,
  LayoutTemplate,
  Loader2,
  Send,
  Smartphone,
  TriangleAlert,
  X,
} from "lucide-react";
import { usePuo } from "@/crm/AuthContext";
import { OrariRapidi } from "@/crm/OrariRapidi";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCRM } from "@/crm/CRMContext";
import { modelliDaProvare } from "@/crm/prova-modelli";
import { cn } from "@/lib/utils";
import { IconaWhatsApp } from "./IconaWhatsApp";
import { ScegliModello } from "./ScegliModello";
import { ScriviDalPonte } from "./ScriviDalPonte";
import { modelloConsigliato } from "./modelli-casella";
import { giornoPerMessaggio } from "@/crm/wa-orari";
import { giornoParlato } from "@/crm/promemoria/formati";

/** Il giorno di calendario a Roma («2026-10-29»). */
const giornoRoma = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
/** I minuti dalla mezzanotte a Roma (per «la consulenza è fra poco»). */
const minutiRoma = (d: Date) => {
  const [h, m] = d
    .toLocaleTimeString("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" })
    .split(":")
    .map(Number);
  return (h % 24) * 60 + m;
};
import {
  FilaSuggerimenti,
  FinestraRisposte,
  idVoce,
  ID_MENU_RISPOSTE,
  MenuRisposte,
} from "./RisposteRapide";
import {
  comandoDi,
  conRisposta,
  filtraRisposte,
  nomePerMessaggio,
  nuovoId,
  riempi,
  senzaRisposta,
  suggerisci,
  ultimoDelCliente,
  type RispostaRapida,
} from "./risposte-rapide";
import { useRisposteRapide } from "./useRisposteRapide";
import { finestra24, type ContattoStato } from "./stato";
import { bozzaDopoAnnulla } from "./stile";
import { bozzaConDettato } from "./dettatura";
import { AvvisoDettatura, BarraDettatura, TastoMicrofono, useDettatura } from "./RegistratoreVoce";
import type { CasellaProps } from "./tipi";

/** La casella in fondo alla chat, come nell'app WhatsApp: fissa in basso, campo a 16 px
 *  (iOS non ingrandisce la pagina), invio da 44 px. Cosa mostra lo decide `api.stato`:
 *  `libera` il testo, `solo_modelli` la scelta dei modelli, `stop` niente, `configura` il blocco. */
export function Casella({ api, linkWa }: CasellaProps) {
  const { bozza, setBozza, residuiBozza, invia, inviando, stato, attiva, canale } = api;
  const { consultants } = useCRM();
  /*  ── PROPONI ORARI (28/10/2026) ────────────────────────────────────────
      Il tasto apre la finestra col calendario di ogni consulente
      (crm/OrariRapidi): si scelgono più orari e «Crea messaggio» lo mette
      nella casella, senza inviare.
      ⚠️ Solo a chi ha l'agenda: senza, le ore tenute per una persona sola non
       arrivano e si vedrebbero libere (un doppio appuntamento). Cambiando chat
       si chiude: gli orari erano scelti per un altro cliente. */
  const puoAgenda = usePuo()("agenda");
  const [orari, setOrari] = useState(false);
  useEffect(() => setOrari(false), [attiva?.phone]);
  //  Finestra chiusa (29/10/2026): la chat si legge tutta e l'elenco dei modelli sta dietro
  //  un pulsante. Parte sempre chiuso, e si richiude cambiando chat.
  const [modelliAperti, setModelliAperti] = useState(false);
  useEffect(() => setModelliAperti(false), [attiva?.phone]);
  //  «Scrivi dal telefono» (30/10/2026): il foglio con il campo di testo, solo a finestra chiusa.
  const [ponteAperto, setPonteAperto] = useState(false);
  useEffect(() => setPonteAperto(false), [attiva?.phone]);
  const nomeConsulente =
    consultants.find((c) => c.id === attiva?.lead?.data.consulenteId)?.data.nome ?? "";

  /*  ── RISPOSTE RAPIDE (28/10/2026) ──────────────────────────────────────
      «/» apre l'elenco, «/2» o «/parola» filtra, Invio o un tocco mette il
      testo nella casella: NON invia. Senza «/», sopra la casella vuota una
      riga di suggerimenti, i più pertinenti all'ultimo messaggio del cliente
      e allo stato del lead. La matita le modifica per tutto lo studio.
      Regole in ./risposte-rapide, disegno in ./RisposteRapide. */
  const { risposte, cambia, ripristina } = useRisposteRapide();
  const libera = stato === "libera";
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const ricerca = libera ? comandoDi(bozza) : null;
  /** Esc chiude l'elenco per QUESTO testo: scrivendo ancora si riapre. */
  const [chiusoPer, setChiusoPer] = useState<string | null>(null);
  const menuAperto = ricerca !== null && chiusoPer !== bozza;
  const voci = useMemo(
    () => (ricerca === null ? [] : filtraRisposte(risposte, ricerca)),
    [risposte, ricerca],
  );
  const [evidenziata, setEvidenziata] = useState(0);
  useEffect(() => setEvidenziata(0), [ricerca]);
  const statoLead = attiva?.lead?.data.stato ?? null;
  const suggerite = useMemo(
    () => suggerisci(risposte, { ultimoCliente: ultimoDelCliente(api.messaggi), stato: statoLead }),
    [risposte, api.messaggi, statoLead],
  );
  const [finestra, setFinestra] = useState<{ daModificare: RispostaRapida | null } | null>(null);

  /*  ── LA X CHE SVUOTA (28/10/2026) ──────────────────────────────────────
      Un tocco cancella tutta la bozza; per qualche secondo una riga sopra la
      casella offre «Annulla». ⚠️ Una riga nella casella e non un avviso in
      basso: sul telefono con la tastiera aperta gli avvisi finiscono sotto la
      tastiera. Cambiando chat l'«Annulla» sparisce: era il testo di un altro. */
  const [cancellata, setCancellata] = useState<string | null>(null);
  useEffect(() => {
    if (cancellata === null) return;
    const t = setTimeout(() => setCancellata(null), 6000);
    return () => clearTimeout(t);
  }, [cancellata]);
  useEffect(() => setCancellata(null), [attiva?.phone]);
  const rimettiFuoco = () => areaRef.current?.focus({ preventScroll: true });
  const svuota = () => {
    if (!bozza) return;
    setCancellata(bozza);
    setBozza("");
    setChiusoPer(null);
    rimettiFuoco();
  };
  const annulla = () => {
    if (cancellata === null) return;
    setBozza(bozzaDopoAnnulla(cancellata, bozza));
    setCancellata(null);
    rimettiFuoco();
  };

  /*  ── DETTATURA (28/10/2026) ────────────────────────────────────────────
      Il microfono: si parla, il testo si AGGIUNGE alla bozza e resta lì da
      rileggere (non parte mai da solo). Al posto dell'invio quando la casella
      è vuota, come WhatsApp; con del testo, accanto alla X. Nascosto se il
      browser non registra (la tastiera dell'iPhone ha già il suo microfono).
      ⚠️ Nessun vocale al cliente: ManyChat non manda audio su WhatsApp.
      Cambiando chat la registrazione si butta: era per un altro cliente. */
  const bozzaRef = useRef(bozza);
  useEffect(() => {
    bozzaRef.current = bozza;
  }, [bozza]);
  const dettatura = useDettatura((t) => {
    setBozza(bozzaConDettato(bozzaRef.current, t));
    setChiusoPer(null);
  });
  const { annulla: annullaDettatura } = dettatura;
  useEffect(() => annullaDettatura(), [attiva?.phone, annullaDettatura]);
  const dettaturaPossibile = dettatura.possibile && libera;
  const detta = dettatura.stato !== "ferma";

  //  Dalla scheda anche giorno, ora e link della consulenza e l'ora del
  //  richiamo (29/10/2026): i messaggi preimpostati partono già completi.
  const scheda = attiva?.lead?.data;
  const giornoConsulenza = /^\d{4}-\d{2}-\d{2}/.test(scheda?.dataMeeting ?? "")
    ? giornoPerMessaggio(scheda!.dataMeeting!.slice(0, 10), giornoRoma(new Date()))
    : "";
  const riempiChat = (t: string) =>
    riempi(t, {
      nome: nomePerMessaggio(attiva?.lead?.data.nome, attiva?.contact?.display_name),
      consulente: nomeConsulente,
      giorno: giornoConsulenza,
      ora: scheda?.oraMeeting,
      link: scheda?.linkMeeting,
      oraRichiamo: scheda?.oraRicontatto,
    });
  const inserisci = (r: RispostaRapida) => {
    const testo = riempiChat(r.testo);
    //  «/…» si sostituisce; un testo già scritto resta e la risposta va sotto.
    setBozza(comandoDi(bozza) !== null || !bozza.trim() ? testo : `${bozza.trimEnd()}\n\n${testo}`);
    setChiusoPer(null);
    requestAnimationFrame(() => {
      const el = areaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  //  Sul telefono con la tastiera aperta il margine del tasto Home è sotto la tastiera: via.
  const quadro =
    "shrink-0 bg-card border-t border-border pb-[env(safe-area-inset-bottom)] group-data-[tastiera=si]/chat:pb-0";

  if (stato === "stop") {
    //  L'avviso intero lo mostra già la conversazione sotto la barra in alto: qui solo una riga discreta.
    return (
      <div className={quadro}>
        <p
          role="status"
          className="flex items-center gap-2 px-3 py-2.5 text-[12px] text-muted-foreground"
        >
          <Ban className="h-3.5 w-3.5 shrink-0" />
          Invio disattivato
        </p>
      </div>
    );
  }

  if (stato === "solo_modelli") {
    const nomeLead = attiva?.lead?.data.nome?.trim() || attiva?.contact?.display_name?.trim() || "";
    //  «Scrivi dal telefono»: il tasto c'è solo se la regola (usaInvioPonte) lo consente.
    const ponteOk = api.ponte?.puo.ok === true;
    const restanti = api.ponte?.restanti ?? null;
    const tastoModello = (
      <Button
        type="button"
        variant="outline"
        onClick={() => setModelliAperti(true)}
        className={cn("min-h-11 shrink-0 gap-1.5 text-[13px]", ponteOk && "flex-1 md:flex-none")}
      >
        <LayoutTemplate className="h-4 w-4" />
        Invia un modello
      </Button>
    );
    return (
      <div className={quadro}>
        {/* Barra compatta: la chat sopra resta tutta leggibile. I tasti sono da 44 px.
            Con «Scrivi dal telefono» disponibile (ponte collegato, il cliente ha già scritto,
            niente STOP) i tasti vanno su una riga a parte sul telefono: il modello prima,
            il telefono accanto. Altrimenti la barra è quella di sempre. */}
        <div
          className={
            ponteOk
              ? "flex flex-col gap-2 px-3 py-2 md:flex-row md:items-center"
              : "flex items-center gap-2 px-3 py-2"
          }
        >
          <p
            role="status"
            className="flex min-w-0 flex-1 items-center gap-2 text-[12px] leading-snug text-amber-800"
          >
            <Clock className="h-3.5 w-3.5 shrink-0" />
            Finestra chiusa · solo modelli approvati
          </p>
          {ponteOk ? (
            <div className="flex gap-2 md:shrink-0">
              {tastoModello}
              <Button
                type="button"
                variant="outline"
                onClick={() => setPonteAperto(true)}
                aria-haspopup="dialog"
                className="min-h-11 flex-1 gap-1.5 text-[13px] md:flex-none"
              >
                <Smartphone className="h-4 w-4" aria-hidden />
                Scrivi dal telefono
              </Button>
            </div>
          ) : (
            tastoModello
          )}
        </div>
        {/*  ── WHATSAPP NATIVO SEMPRE (30/10/2026) ───────────────────────────
            A casella bloccata il modo gratuito per scrivere a mano è l'app WhatsApp
            del telefono: il tasto sta in barra, da 44 px, non nascosto in un menu. */}
        {linkWa && (
          <div className="px-3 pb-2">
            <Button
              asChild
              variant="outline"
              className="min-h-11 w-full gap-2 border-emerald-300 text-[13px] text-emerald-800 hover:bg-emerald-50 md:w-auto"
            >
              <a
                href={linkWa}
                target={linkWa.startsWith("https:") ? "_blank" : undefined}
                rel="noopener noreferrer"
              >
                <IconaWhatsApp className="h-4 w-4 text-emerald-600" />
                Apri in WhatsApp
              </a>
            </Button>
          </div>
        )}
        {ponteOk && restanti !== null && restanti <= 5 && (
          <p className="px-3 pb-2 text-[11.5px] text-muted-foreground">
            {`Dal telefono puoi mandare ancora ${restanti} ${restanti === 1 ? "messaggio" : "messaggi"} nelle prossime 24 ore.`}
          </p>
        )}
        {bozza.trim() && (
          <p className="px-3 pb-2 text-[11.5px] text-muted-foreground">
            Il testo che hai scritto è conservato: tornerà nella casella quando il cliente riscrive.
          </p>
        )}
        <Sheet open={modelliAperti} onOpenChange={setModelliAperti}>
          {/* Foglio dal basso; da tablet in su una colonna centrata, non a tutta larghezza.
              La X di serie è piccola: la sostituisce il tasto «Chiudi» da 44 px. */}
          <SheetContent
            side="bottom"
            className="crm-theme mx-auto flex max-h-[85dvh] w-full flex-col gap-0 rounded-t-xl bg-white p-0 text-foreground sm:max-w-lg [&>button]:hidden"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
              <SheetTitle className="text-[15px]">Invia un modello</SheetTitle>
              <SheetClose asChild>
                <Button type="button" variant="ghost" className="min-h-11 text-[13px]">
                  Chiudi
                </Button>
              </SheetClose>
            </div>
            <SheetDescription className="sr-only">
              Scegli il modello approvato da mandare a questo numero. Ogni modello si paga.
            </SheetDescription>
            {/* La chiave è il numero: cambiando chat si riparte da capo (niente valori dell'altro cliente). */}
            <ScegliModello
              key={attiva?.phone ?? ""}
              modelli={modelliDaProvare(canale)}
              canale={canale?.canale ?? null}
              dati={{ nomeLead, nomeConsulente }}
              consigliato={modelloConsigliato(
                modelliDaProvare(canale),
                attiva?.lead?.data,
                { nomeLead, nomeConsulente },
                giornoRoma(new Date()),
                giornoParlato,
                minutiRoma(new Date()),
              )}
              inviando={inviando}
              onInvia={async (m) => {
                await api.inviaModello(m);
                setModelliAperti(false);
              }}
            />
          </SheetContent>
        </Sheet>
        {/* La chiave è il numero: cambiando chat il foglio riparte da un campo vuoto. */}
        {api.ponte && (
          <ScriviDalPonte
            key={attiva?.phone ?? ""}
            api={api.ponte}
            aperto={ponteAperto}
            onAperto={setPonteAperto}
          />
        )}
      </div>
    );
  }

  const configurata = stato !== "configura";
  const frase =
    configurata &&
    (attiva?.finestra?.frase ??
      //  shortcut: riga del contatto passata con un cast (un'interface non ha la firma d'indice di ContattoStato); T7 riempie `finestra` e il ripiego sparisce.
      finestra24({
        contatto: (attiva?.contact ?? null) as ContattoStato | null,
        messaggi: api.messaggi,
        adesso: Date.now(),
      }).frase);
  return (
    <div className={quadro}>
      {orari && puoAgenda && configurata && (
        <OrariRapidi
          nome={attiva?.lead?.data?.nome}
          consulenteId={attiva?.lead?.data?.consulenteId}
          onInserisci={(t) => {
            setBozza(bozza.trim() ? `${bozza.trimEnd()}\n\n${t}` : t);
            setOrari(false);
          }}
          onChiudi={() => setOrari(false)}
        />
      )}
      {residuiBozza.length > 0 && (
        <div className="px-3 pt-2">
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11.5px] text-amber-800">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-px" />
            <span>
              <span className="font-semibold">{residuiBozza.join("  ")}</span> non verrà sostituito:
              arriverebbe scritto così al cliente. Scrivi il dato al posto del segnaposto.
            </span>
          </div>
        </div>
      )}
      {frase && (
        <p className="flex items-center gap-1.5 px-3 pt-2 text-[11.5px] text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          {frase}
        </p>
      )}
      {menuAperto && (
        <MenuRisposte
          voci={voci}
          ricerca={ricerca ?? ""}
          evidenziata={evidenziata}
          onEvidenzia={setEvidenziata}
          riempi={riempiChat}
          onScegli={inserisci}
          onModifica={(r) => setFinestra({ daModificare: r })}
        />
      )}
      {cancellata !== null && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 px-3 pt-2 text-[13px] text-muted-foreground"
        >
          <span>Messaggio cancellato</span>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={annulla}
            className="inline-flex min-h-9 items-center rounded-full px-3 font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Annulla
          </button>
        </div>
      )}
      {libera &&
        cancellata === null &&
        !menuAperto &&
        !orari &&
        !bozza.trim() &&
        suggerite.length > 0 && (
          <FilaSuggerimenti
            risposte={suggerite}
            onScegli={inserisci}
            onGestisci={() => setFinestra({ daModificare: null })}
          />
        )}
      <AvvisoDettatura d={dettatura} />
      <FinestraRisposte
        aperta={finestra !== null}
        daModificare={finestra?.daModificare ?? null}
        risposte={risposte}
        onChiudi={() => setFinestra(null)}
        onSalva={({ id, titolo, testo }) => {
          //  L'id si sceglie una volta: il cambio si rifà anche sull'elenco riletto.
          const nuova = id ?? nuovoId(risposte, Date.now().toString(36));
          cambia((l) => conRisposta(l, { id: nuova, titolo, testo }));
        }}
        onElimina={(id) => cambia((l) => senzaRisposta(l, id))}
        onRipristina={ripristina}
      />
      {detta && <BarraDettatura d={dettatura} />}
      <div className={cn("px-3 py-2 flex items-end gap-2", detta && "hidden")}>
        {puoAgenda && configurata && (
          <Button
            type="button"
            size="icon"
            variant={orari ? "default" : "outline"}
            onClick={() => setOrari((v) => !v)}
            aria-label="Proponi orari liberi"
            aria-haspopup="dialog"
            title="Proponi orari liberi"
            className="h-11 w-11 shrink-0 rounded-full"
          >
            <CalendarClock className="h-4 w-4" />
          </Button>
        )}
        {/*  ── LA CASELLA SI APRE AL PRIMO TOCCO (28/10/2026) ─────────────────
            Guasto del titolare (iPhone, browser dentro un'app): toccando la
            casella vuota non arrivava la tastiera; arrivava solo scegliendo una
            risposta rapida. Fra le due strade l'unica differenza nel codice è lo
            scorrimento: la risposta rapida mette il fuoco con `preventScroll`,
            il tocco invece lascia che iOS faccia scorrere la vista fino al campo
            — e lì il vecchio `window.scrollTo(0, 0)` chiamato al fuoco lo
            riportava in cima mentre la chat (fissa sull'area visibile, vedi
            PaginaChat) si spostava con la vista. Ora il fuoco non tocca lo
            scorrimento: la posizione la tiene solo `visualViewport`.
            E tutta la «pillola» è bersaglio: un tocco sul suo bordo o accanto
            alla X apre lo stesso la tastiera. Vedi la LAVAGNA della commessa
            2026-10-28-chat-stile-whatsapp per cosa è provato e cosa no. */}
        <div
          onPointerDown={(e) => {
            if (e.target !== e.currentTarget || !configurata) return;
            e.preventDefault();
            areaRef.current?.focus();
          }}
          className={cn(
            "flex min-w-0 flex-1 cursor-text items-end rounded-[22px] border border-input bg-background",
            "focus-within:ring-1 focus-within:ring-ring md:rounded-lg",
          )}
        >
          <textarea
            ref={areaRef}
            value={bozza}
            onChange={(e) => setBozza(e.target.value)}
            onKeyDown={(e) => {
              if (menuAperto && !e.nativeEvent.isComposing) {
                const n = voci.length;
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  if (n) setEvidenziata((i) => (i + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setChiusoPer(bozza);
                  return;
                }
                if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
                  //  Invio sceglie, non invia: «/2» non deve mai partire al cliente.
                  e.preventDefault();
                  const scelta = voci[Math.min(evidenziata, n - 1)];
                  if (scelta) inserisci(scelta.risposta);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (!inviando) void invia();
              }
            }}
            placeholder={
              configurata
                ? "Messaggio, o / per le risposte"
                : "Configura WhatsApp in Impostazioni per inviare"
            }
            role={libera ? "combobox" : undefined}
            aria-autocomplete={libera ? "list" : undefined}
            aria-expanded={libera ? menuAperto : undefined}
            aria-controls={menuAperto && voci.length ? ID_MENU_RISPOSTE : undefined}
            aria-activedescendant={
              menuAperto && voci.length ? idVoce(Math.min(evidenziata, voci.length - 1)) : undefined
            }
            disabled={!configurata}
            enterKeyHint="send"
            rows={Math.min(6, Math.max(1, bozza.split("\n").length))}
            aria-label="Messaggio"
            className={cn(
              "flex-1 min-w-0 min-h-11 bg-transparent text-foreground placeholder:text-muted-foreground",
              "focus:outline-none resize-none rounded-[22px] px-4 py-2.5 max-h-40 [field-sizing:content]",
              //  16 px sul telefono: sotto, iOS ingrandisce la pagina al tocco.
              "text-base leading-6 md:min-h-10 md:text-[14px] md:leading-5 md:rounded-lg md:px-3",
            )}
          />
          {bozza !== "" && configurata && (
            <button
              type="button"
              //  Il tocco non toglie il fuoco alla casella: la tastiera resta su.
              onMouseDown={(e) => e.preventDefault()}
              onClick={svuota}
              aria-label="Svuota il messaggio"
              title="Svuota il messaggio"
              className="grid h-11 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
            >
              <X className="h-[18px] w-[18px]" aria-hidden />
            </button>
          )}
          {bozza.trim() !== "" && dettaturaPossibile && <TastoMicrofono d={dettatura} />}
        </div>
        {!bozza.trim() && dettaturaPossibile ? (
          <TastoMicrofono d={dettatura} grande />
        ) : (
          <Button
            onClick={() => void invia()}
            size="icon"
            aria-label="Invia messaggio"
            disabled={!bozza.trim() || inviando || !configurata}
            className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full h-11 w-11 shrink-0 disabled:opacity-50"
          >
            {inviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}
