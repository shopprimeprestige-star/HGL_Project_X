import { useEffect, useMemo, useRef, useState } from "react";
import { Ban, CalendarClock, Clock, Loader2, Send, TriangleAlert, X } from "lucide-react";
import { usePuo } from "@/crm/AuthContext";
import { OrariRapidi } from "@/crm/OrariRapidi";
import { Button } from "@/components/ui/button";
import { useCRM } from "@/crm/CRMContext";
import { modelliDaProvare } from "@/crm/prova-modelli";
import { cn } from "@/lib/utils";
import { ScegliModello } from "./ScegliModello";
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
import type { CasellaProps } from "./tipi";

/** La frase della finestra chiusa, quella di `stato.ts` (mai scritta due volte). */
const FRASE_CHIUSA = finestra24({ contatto: null, messaggi: [], adesso: 0 }).frase;

/** La casella in fondo alla chat, come nell'app WhatsApp: fissa in basso, campo a 16 px
 *  (iOS non ingrandisce la pagina), invio da 44 px. Cosa mostra lo decide `api.stato`:
 *  `libera` il testo, `solo_modelli` la scelta dei modelli, `stop` niente, `configura` il blocco. */
export function Casella({ api }: CasellaProps) {
  const { bozza, setBozza, residuiBozza, invia, inviando, stato, attiva, canale } = api;
  const { consultants } = useCRM();
  /*  ── PROPONI ORARI (28/10/2026) ────────────────────────────────────────
      Giorni e ore libere (crm/OrariRapidi) e il messaggio si scrive da solo.
      ⚠️ Solo a chi ha l'agenda: senza, le ore tenute per una persona sola non
       arrivano e si vedrebbero libere (un doppio appuntamento). Cambiando chat
       si chiude: gli orari erano scelti per un altro cliente. */
  const puoAgenda = usePuo()("agenda");
  const [orari, setOrari] = useState(false);
  useEffect(() => setOrari(false), [attiva?.phone]);
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

  const riempiChat = (t: string) =>
    riempi(t, {
      nome: nomePerMessaggio(attiva?.lead?.data.nome, attiva?.contact?.display_name),
      consulente: nomeConsulente,
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
    return (
      <div className={quadro}>
        <p role="status" className="flex items-start gap-2 px-3 pt-2.5 text-[12px] text-amber-800">
          <Clock className="h-3.5 w-3.5 shrink-0 mt-px" />
          {FRASE_CHIUSA}
        </p>
        {bozza.trim() && (
          <p className="px-3 pt-1 text-[11.5px] text-muted-foreground">
            Il testo che hai scritto è conservato: tornerà nella casella quando il cliente riscrive.
          </p>
        )}
        {/* La chiave è il numero: cambiando chat si riparte da capo (niente valori dell'altro cliente). */}
        <ScegliModello
          key={attiva?.phone ?? ""}
          modelli={modelliDaProvare(canale)}
          canale={canale?.canale ?? null}
          dati={{ nomeLead, nomeConsulente }}
          inviando={inviando}
          onInvia={api.inviaModello}
        />
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
      <div className="px-3 py-2 flex items-end gap-2">
        {puoAgenda && configurata && (
          <Button
            type="button"
            size="icon"
            variant={orari ? "default" : "outline"}
            onClick={() => setOrari((v) => !v)}
            aria-label="Proponi orari liberi"
            aria-expanded={orari}
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
        </div>
        <Button
          onClick={() => void invia()}
          size="icon"
          aria-label="Invia messaggio"
          disabled={!bozza.trim() || inviando || !configurata}
          className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full h-11 w-11 shrink-0 disabled:opacity-50"
        >
          {inviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
