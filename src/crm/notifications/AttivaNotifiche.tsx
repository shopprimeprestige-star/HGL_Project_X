/** ── IL PULSANTE CHE ACCENDE TUTTO ─────────────────────────────────────────
 *
 *  Un browser non lascia comparire una notifica se il permesso non è stato
 *  concesso, e non concede il permesso se la richiesta non nasce da un gesto
 *  dell'utente. Lo stesso vale per il suono: l'audio resta muto finché la
 *  pagina non viene toccata. Sono due vincoli, non due bug, e questo componente
 *  è il posto in cui vengono risolti entrambi con lo stesso clic.
 *
 *  Perché un componente e non tre pulsanti sparsi: lo stesso blocco compare
 *  nella campanella, nelle impostazioni e nella pagina Notifiche. Se il testo
 *  che spiega come sbloccare le notifiche esistesse in tre copie, due
 *  resterebbero indietro.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Clock, Share, Smartphone, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  EVENTO_AUDIO,
  provaSuono,
  sbloccaAudio,
  statoAudio,
  type StatoAudio,
} from "@/crm/suoni-crm";
import { spiegazione, notificaDiProva, usePermesso, type StatoPermesso } from "./permesso";
import { convieneInstallare, inApp, preparaCanaleSistema, suApple } from "./canale-sistema";
import { richiediGiro } from "./motore";
import { leggiPrefs } from "./prefs-browser";
import { EVENTO_STORICO, leggiSospesi } from "./registro";

/** Il colore è un segnale: verde solo quando arriva davvero tutto, ambra
 *  quando manca un passaggio, rosso quando serve andare nelle impostazioni. */
const TONO: Record<StatoPermesso, string> = {
  concesso: "border-emerald-200 bg-emerald-50 text-emerald-900",
  da_chiedere: "border-amber-200 bg-amber-50 text-amber-900",
  negato: "border-rose-200 bg-rose-50 text-rose-900",
  non_supportato: "border-slate-200 bg-slate-50 text-slate-700",
};

const ICONA: Record<StatoPermesso, typeof Bell> = {
  concesso: BellRing,
  da_chiedere: Bell,
  negato: BellOff,
  non_supportato: BellOff,
};

/** Lo stato dell'audio, aggiornato quando il contesto si risveglia davvero.
 *  Il risveglio avviene al primo clic qualunque nella pagina, che React non
 *  vede: senza l'evento, la schermata continuerebbe a dire "in attesa". */
export function useStatoAudio(): StatoAudio {
  const [stato, setStato] = useState<StatoAudio>("bloccato");
  useEffect(() => {
    const aggiorna = () => setStato(statoAudio());
    aggiorna();
    window.addEventListener(EVENTO_AUDIO, aggiorna);
    document.addEventListener("visibilitychange", aggiorna);
    return () => {
      window.removeEventListener(EVENTO_AUDIO, aggiorna);
      document.removeEventListener("visibilitychange", aggiorna);
    };
  }, []);
  return stato;
}

/** Quanti avvisi aspettano il permesso per arrivare sulla scrivania. Sono già
 *  nella campanella: qui servono a dire "non li hai persi", che è la domanda
 *  vera di chi attiva le notifiche a metà mattina. */
function useInAttesa(): number {
  const [quanti, setQuanti] = useState(0);
  useEffect(() => {
    const aggiorna = () => setQuanti(leggiSospesi().length);
    aggiorna();
    window.addEventListener(EVENTO_STORICO, aggiorna);
    window.addEventListener("storage", aggiorna);
    return () => {
      window.removeEventListener(EVENTO_STORICO, aggiorna);
      window.removeEventListener("storage", aggiorna);
    };
  }, []);
  return quanti;
}

/** ── LO STATO DEL TELEFONO ─────────────────────────────────────────────────
 *  Si calcola dopo il montaggio e mai durante il rendering sul server: lì non
 *  esistono né `matchMedia` né `navigator`, e un primo disegno che dice una
 *  cosa e il secondo un'altra fa lampeggiare il riquadro.
 *  ───────────────────────────────────────────────────────────────────────── */
function useTelefono(): {
  conviene: boolean;
  apple: boolean;
  installata: boolean;
  /** Falso al primo disegno (server e idratazione), vero da lì in poi. Serve a
   *  chi deve scegliere fra una frase generica e una che dipende dal
   *  dispositivo: prima del montaggio l'unica risposta onesta è "non lo so". */
  montato: boolean;
} {
  const [s, setS] = useState({
    conviene: false,
    apple: false,
    installata: false,
    montato: false,
  });
  useEffect(() => {
    const aggiorna = () =>
      setS({
        conviene: convieneInstallare(),
        apple: suApple(),
        installata: inApp(),
        montato: true,
      });
    aggiorna();
    // Aggiungere il CRM alla schermata Home e riaprirlo cambia `display-mode`
    // senza ricaricare nulla: senza questo ascolto il riquadro continuerebbe a
    // chiedere di installare un'applicazione già installata.
    const mq = window.matchMedia?.("(display-mode: standalone)");
    mq?.addEventListener?.("change", aggiorna);
    return () => mq?.removeEventListener?.("change", aggiorna);
  }, []);
  return s;
}

export function AttivaNotifiche({
  compatto,
  className,
}: {
  /** Versione a due righe per la campanella: niente prova del suono. */
  compatto?: boolean;
  className?: string;
}) {
  const { stato, chiedi, inCorso } = usePermesso();
  const audio = useStatoAudio();
  const inAttesa = useInAttesa();
  const [provaInCorso, setProvaInCorso] = useState(false);
  const [esitoProva, setEsitoProva] = useState<string | null>(null);
  const telefono = useTelefono();

  // Il canale di sistema si prepara anche solo aprendo questo riquadro: chi
  // arriva qui dalla campanella, senza passare dal guscio del CRM, deve trovare
  // il service worker già registrato quando preme "Attiva".
  useEffect(() => {
    void preparaCanaleSistema();
  }, []);

  const attiva = useCallback(async () => {
    // Siamo dentro un clic: è l'unico momento in cui il browser accetta sia la
    // richiesta di permesso sia il risveglio dell'audio. L'audio si sblocca per
    // primo, e SENZA aspettarlo: la parte che richiede il gesto (creare il
    // contesto) è sincrona, mentre mettersi in attesa della promessa
    // consumerebbe il gesto e il pop-up del permesso non comparirebbe più.
    void sbloccaAudio();
    const esito = await chiedi();
    if (esito !== "concesso") return;
    // Il gesto è già stato speso nella richiesta di permesso: da qui in poi si
    // può aspettare. E si DEVE aspettare, perché sul telefono la notifica di
    // conferma esce solo dal service worker: chiederla prima che sia attivo
    // significherebbe non vedere niente proprio nel momento in cui l'utente
    // sta guardando se ha funzionato.
    await preparaCanaleSistema();
    // La conferma si vede e si sente subito: un pulsante che non produce nulla
    // di visibile viene premuto tre volte e poi dato per rotto.
    const prefs = leggiPrefs();
    notificaDiProva("Notifiche attive", "Da adesso gli avvisi del CRM arrivano qui.");
    if (prefs.suono) void provaSuono("discreto", prefs.volume);
    // E il giro parte subito: se qualcosa aspettava in coda, arriva adesso.
    richiediGiro();
  }, [chiedi]);

  /** Una prova completa: il riquadro sulla scrivania E il suono, cioè
   *  esattamente quello che succede quando arriva un avviso vero. */
  const prova = useCallback(async () => {
    setProvaInCorso(true);
    const prefs = leggiPrefs();
    // Stessa ragione dell'attivazione: senza il worker attivo, sul telefono la
    // prova fallirebbe sempre e il CRM sembrerebbe rotto quando non lo è.
    await preparaCanaleSistema();
    const vista = notificaDiProva(
      "Prova di notifica",
      "Se leggi questo riquadro, gli avvisi del CRM funzionano.",
    );
    const sentita = prefs.suono ? await provaSuono("discreto", prefs.volume) : false;
    setEsitoProva(
      vista && sentita
        ? "Riquadro e suono partiti."
        : vista
          ? prefs.suono
            ? "Riquadro inviato, ma il browser non ha lasciato passare l'audio: alza il volume di sistema e riprova."
            : "Riquadro inviato. Il suono è disattivato nelle impostazioni."
          : "Il browser non ha mostrato il riquadro. Sul telefono aggiungi il CRM alla schermata Home e riprova da lì.",
    );
    setProvaInCorso(false);
  }, []);

  const Icona = ICONA[stato];
  // La frase che dipende dal dispositivo (iPhone da aggiungere alla schermata
  // Home) si può dire solo dopo il montaggio: prima si dice quella neutra, che
  // è anche quella disegnata dal server. Vedi la nota in `permesso.ts`.
  const testi = spiegazione(stato, telefono.montato);

  return (
    <div className={cn("rounded-xl border p-3", TONO[stato], className)}>
      <div className="flex items-start gap-2.5">
        <Icona className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold leading-tight">{testi.titolo}</p>
          <p className="mt-0.5 text-[11.5px] leading-snug opacity-80">{testi.testo}</p>

          {/* Il permesso concesso non basta a far uscire il suono: finché la
              pagina non viene toccata l'audio resta bloccato, e dirlo evita
              la segnalazione "le notifiche arrivano ma sono mute". */}
          {stato === "concesso" && audio !== "pronto" && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-snug opacity-80">
              <Volume2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Il suono si attiva al primo clic su questa pagina.
            </p>
          )}

          {/* Chi attiva a metà giornata deve sapere che non ha perso nulla:
              quello che è successo mentre il permesso mancava è in coda e
              arriva al primo giro utile. */}
          {inAttesa > 0 && stato !== "concesso" && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-snug opacity-80">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {inAttesa === 1
                ? "1 avviso è in attesa e arriva appena attivi."
                : `${inAttesa} avvisi sono in attesa e arrivano appena attivi.`}
            </p>
          )}

          {/* ── SUL TELEFONO ────────────────────────────────────────────────
              Le due righe senza le quali l'utente aspetta per sempre un avviso
              che non può arrivare. Su iPhone è un prerequisito vero (senza la
              schermata Home il permesso non si può nemmeno chiedere); su
              Android è un consiglio, perché una scheda del browser viene chiusa
              e con lei muoiono gli avvisi. Due frasi diverse perché sono due
              situazioni diverse, e la frase sbagliata manda a fare un giro
              inutile. */}
          {telefono.conviene && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-snug opacity-80">
              {telefono.apple ? (
                <Share className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              ) : (
                <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              {telefono.apple
                ? "Su iPhone gli avvisi arrivano solo dal CRM aggiunto alla schermata Home: menù Condividi → «Aggiungi a Home», poi apri il CRM da quell'icona."
                : "Sul telefono aggiungi il CRM alla schermata Home (menù del browser → «Installa app»): da una scheda normale gli avvisi si fermano appena la chiudi."}
            </p>
          )}

          {(stato === "da_chiedere" || (stato === "concesso" && audio !== "pronto")) && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-7 bg-white/70 px-2.5 text-[11.5px]"
              onClick={attiva}
              disabled={inCorso}
            >
              {stato === "concesso" ? "Sblocca il suono" : "Attiva le notifiche"}
            </Button>
          )}

          {!compatto && stato === "concesso" && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 bg-white/70 px-2.5 text-[11.5px]"
                onClick={prova}
                disabled={provaInCorso}
              >
                <Volume2 className="h-3.5 w-3.5" /> Prova adesso
              </Button>
              {esitoProva && <span className="text-[11px] opacity-75">{esitoProva}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
