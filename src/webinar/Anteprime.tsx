/** ── QUELLO CHE VEDONO LORO, MENTRE TU PARLI ────────────────────────────────
 *
 *  Due anteprime, e nascono dalla stessa domanda: «sono sicuro che dall'altra
 *  parte si veda?». È la domanda che durante una diretta non si può verificare
 *  — non puoi prendere il telefono e collegarti mentre stai parlando — e che
 *  senza risposta si trasforma in un messaggio in chat che dice «non si vede
 *  niente», di solito dieci minuti dopo.
 */
import { attaccaFlusso } from "@/webinar/attacca";
import { CAMPIONI_AL_BUIO, cameraSpenta, guardaSeBuia, quandoRiguardare } from "@/webinar/camera-buia";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Monitor, Smartphone, Tablet, X } from "lucide-react";
//  La regola vive in un modulo puro, per poterla provare: qui si ri-esporta
//  così chi disegna ha un posto solo da cui prendere le cose.
export { colonnePerCamere } from "./griglia";
import { chiSiVede, colonnePerCamere } from "./griglia";

/** ── LA GRIGLIA DELLE CAMERE ───────────────────────────────────────────────
 *  ⚠️ È LA STESSA REGOLA DI MEETLY, copiata dalla riga che la decide in
 *   `shop/call.tsx`: 1→1, 2→2, 3→3, 4→2, fino a 6→3, fino a 9→3, poi la
 *   radice quadrata. Non è una scelta arbitraria — quattro camere su due
 *   colonne fanno un quadrato, su quattro colonne fanno una striscia di
 *   francobolli — ed è già quella a cui l'occhio di chi presenta è abituato.
 *   Inventarne una seconda vorrebbe dire due griglie diverse per la stessa
 *   cosa nello stesso programma. */
/** La larghezza della finestra, per decidere quante colonne stanno. Si
 *  aggiorna girando il telefono: in orizzontale ci sta una colonna in più, e
 *  girarlo è proprio quello che si fa quando non si vede bene. */
export function useLarghezza(): number {
  const [w, setW] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
  useEffect(() => {
    const misura = () => setW(window.innerWidth);
    window.addEventListener("resize", misura);
    window.addEventListener("orientationchange", misura);
    return () => {
      window.removeEventListener("resize", misura);
      window.removeEventListener("orientationchange", misura);
    };
  }, []);
  return w;
}

export interface Camera {
  chiave: string;
  nome: string;
  stream: MediaStream | null;
  /** la tua: va MUTA o è larsen */
  mia?: boolean;
  parla?: boolean;
  /** in onda adesso. Chi non lo è resta visibile in console ma smorzato: devi
   *  poter vedere chi sta per parlare PRIMA di mandarlo in onda. */
  inOnda?: boolean;
  /** sta grande, da solo sopra gli altri */
  primoPiano?: boolean;
  /** il suo microfono è aperto? Assente = non lo sappiamo (la propria camera,
   *  o un riquadro fuori dal salotto). */
  microfono?: boolean;
}

function Riquadro({
  c, onTocco, onMuto, riempi,
}: {
  c: Camera;
  /** ⚠️ Riempi la cella invece di imporre un 16:9. Serve al faccia a faccia,
   *  dove la cella è un QUADRATO: con `aspect-video` il riquadro sarebbe più
   *  basso della cella e sotto sarebbe rimasta una fascia nera alta un quarto
   *  del quadrato — proprio nel montaggio che esiste per far vedere due facce
   *  grandi e alla pari. */
  riempi?: boolean;
  onTocco?: (chiave: string) => void;
  /** ⚠️ Solo in console: chiudere il microfono di qualcuno è una cosa che può
   *  fare chi conduce, e nessun altro. */
  onMuto?: (chiave: string, acceso: boolean) => void;
}) {
  //  Cambia quando la camera viene spenta e riaccesa: serve a rifare il conto
  //  delle tracce senza aspettare un altro disegno.
  const [, ridisegna] = useState(0);

  /** ── ⚠️ IL VIDEO NERO PASSANDO A SALOTTO: ERANO DUE COSE ────────────────
   *  1. Il riquadro cambiava tipo di elemento — `div` fuori dal salotto,
   *     `button` dentro, perché dentro si può toccare per il primo piano. Un
   *     tipo diverso fa SMONTARE e RIMONTARE tutto il sottoalbero, `<video>`
   *     compreso: nasceva un elemento nuovo e vuoto.
   *  2. L'aggancio del flusso stava in un effetto legato a `c.stream`. Sembra
   *     giusto e non lo è: sull'elemento nuovo il flusso è LO STESSO di prima,
   *     quindi per l'effetto non c'era niente da riagganciare. Nero, senza un
   *     errore e senza un motivo visibile.
   *  Adesso l'elemento è sempre un `div` (il comando è un riquadro trasparente
   *  sopra) e l'aggancio avviene sull'ELEMENTO tramite un `ref` a funzione:
   *  ogni video che nasce viene collegato, per costruzione.
   *  ⚠️ E `muted` si mette anche a mano: React lo tratta come proprietà, e su
   *   un elemento appena creato può arrivare DOPO il `play()` — che a quel
   *   punto il browser blocca, perché un video con audio non parte da solo. */
  //  ⚠️ ERA UNA COPIA di `attaccaFlusso`: vedi la nota gemella in
  //   FasciaRelatori. Una regola sola, in un posto solo.
  const aggancia = useCallback(
    (el: HTMLVideoElement | null) => attaccaFlusso(c.stream, c.mia)(el),
    [c.stream, c.mia],
  );

  //  Camera spenta o riaccesa: il riquadro deve cambiare faccia. `enabled` non
  //  emette eventi, quindi si guarda anche a intervallo — una volta al secondo,
  //  che per un pallino acceso/spento è più che sufficiente.
  useEffect(() => {
    const t = c.stream?.getVideoTracks()[0];
    if (!t) return;
    const sveglia = () => ridisegna((n) => n + 1);
    t.addEventListener("mute", sveglia);
    t.addEventListener("unmute", sveglia);
    t.addEventListener("ended", sveglia);
    const orologio = setInterval(sveglia, 1000);
    return () => {
      t.removeEventListener("mute", sveglia);
      t.removeEventListener("unmute", sveglia);
      t.removeEventListener("ended", sveglia);
      clearInterval(orologio);
    };
  }, [c.stream]);

  const traccia = c.stream?.getVideoTracks()[0];
  //  ⚠️ Non basta che la traccia ESISTA: spenta col pulsante resta lì e dà
  //   fotogrammi neri. Si guarda anche se è accesa e viva.
  /** ── ⚠️ UNA TRACCIA VIVA PUÒ PORTARE SOLO NERO ────────────────────────
   *  Il perché e le soglie stanno in `webinar/camera-buia`, e il caso è stato
   *  misurato su una diretta vera: traccia `live`, non muta, tempo che scorre,
   *  risoluzione vera — e ogni pixel nero. Succede quando il telefono di chi
   *  partecipa manda il browser in secondo piano.
   *  ⚠️ Serve anche QUI, non solo in sala: chi conduce guardava un quadrato
   *   nero col nome sopra e non aveva modo di sapere se era un guasto suo, del
   *   collegamento o del telefono dall'altra parte. */
  const campioni = useRef<number[]>([]);
  const [buia, setBuia] = useState(false);
  const elVideo = useRef<HTMLVideoElement | null>(null);
  //  ⚠️ Ritmo variabile e sfalsato, non un intervallo fisso per ogni riquadro:
  //   quattro camere che leggono i pixel nello stesso istante facevano andare
  //   a scatti la diretta. Vedi `webinar/camera-buia`.
  useEffect(() => {
    campioni.current = [];
    setBuia(false);
    if (!c.stream) return;
    let vivo = true;
    let prossimo: ReturnType<typeof setTimeout> | null = null;
    const giro = () => {
      if (!vivo) return;
      const v = elVideo.current;
      let buiaOra = false;
      if (v) {
        const luce = guardaSeBuia(v);
        if (luce !== null) {
          campioni.current = [...campioni.current, luce].slice(-CAMPIONI_AL_BUIO);
          buiaOra = cameraSpenta(campioni.current);
          setBuia(buiaOra);
        }
      }
      prossimo = setTimeout(giro, quandoRiguardare({
        buia: buiaOra,
        deciso: campioni.current.length >= CAMPIONI_AL_BUIO,
        chiave: c.chiave || "",
      }));
    };
    prossimo = setTimeout(giro, 1200);
    return () => { vivo = false; if (prossimo) clearTimeout(prossimo); };
  }, [c.stream, c.chiave]);

  const conVideo = !!traccia && traccia.enabled && traccia.readyState === "live" && !buia;

  return (
    <div
      title={onTocco ? (c.primoPiano ? "Togli dal primo piano" : "Portalo in primo piano") : undefined}
      className={`relative block w-full overflow-hidden rounded-lg border bg-black/60 text-left transition ${riempi ? "h-full" : ""} ${
        c.primoPiano
          //  Il primo piano si vede PRIMA di leggere il nome: è la cosa che si
          //  cerca con la coda dell'occhio mentre si sta parlando.
          ? "border-brand ring-2 ring-brand/50"
          : c.parla ? "border-emerald-400/70" : "border-white/15"
      } ${c.inOnda === false ? "opacity-35 grayscale" : ""}`}
    >
      {/*  Il comando è un riquadro trasparente SOPRA il video, non il video
          stesso: così toccare per il primo piano non cambia niente dell'albero
          e il flusso non si stacca. */}
      {onTocco && (
        <button
          type="button"
          onClick={() => onTocco(c.chiave)}
          aria-label={c.primoPiano ? `Togli ${c.nome} dal primo piano` : `Porta ${c.nome} in primo piano`}
          className="absolute inset-0 z-10 cursor-pointer"
        />
      )}
      {/* ── ⚠️ CHIUDERE IL MICROFONO A CHI È SUL PALCO ────────────────────
            È il comando più urgente che esista in una diretta: una persona che
            ha la parola e di colpo si mette a parlare col figlio, o ha la
            televisione accesa dietro. Cercarlo in un pannello, in quel
            momento, vuol dire trenta secondi di rumore davanti a duecento
            persone.
           ⚠️ STA SOPRA IL COMANDO DEL PRIMO PIANO (`z-20` contro `z-10`) e non
            sotto: sono sovrapposti, e se vincesse quello del primo piano
            toccando il microfono si manderebbe la persona a tutto schermo
            invece di zittirla. */}
      {onMuto && !c.mia && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMuto(c.chiave, !c.microfono); }}
          title={c.microfono === false ? `Riapri il microfono a ${c.nome}` : `Chiudi il microfono a ${c.nome}`}
          aria-label={c.microfono === false ? `Riapri il microfono a ${c.nome}` : `Chiudi il microfono a ${c.nome}`}
          className={`absolute right-1 top-1 z-20 rounded-md border p-1 transition ${
            c.microfono === false
              ? "border-rose-400/50 bg-rose-500/25 text-rose-200"
              : "border-white/20 bg-black/50 text-white/70 hover:bg-black/70 hover:text-white"
          }`}
        >
          {c.microfono === false ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
        </button>
      )}

      {/*  ⚠️ Il video resta MONTATO anche quando è buio, solo nascosto:
            smontandolo il campionamento non avrebbe più niente da guardare e
            non si accorgerebbe mai che la camera è tornata. */}
      {!!c.stream && (
        <video
          ref={(v) => { elVideo.current = v; aggancia(v); }}
          playsInline
          autoPlay
          //  ⚠️ La PROPRIA camera va sempre muta: il proprio audio che torna
          //   dagli altoparlanti è il fischio che fa interrompere la diretta.
          muted={c.mia}
          //  E specchiata, come in ogni videochiamata: ci si guarda come allo
          //  specchio, non come una telecamera di sorveglianza.
          className={`w-full bg-black object-cover ${riempi ? "h-full" : "aspect-video"} ${c.mia ? "-scale-x-100" : ""} ${conVideo ? "" : "invisible absolute inset-0"}`}
        />
      )}
      {!conVideo && (
        //  ⚠️ NON un rettangolo nero: l'iniziale, e — se la camera è stata
        //   spenta a mano — anche il perché. Un nero muto si legge come un
        //   guasto, e si finisce a cercare un problema che non c'è.
        <div className={`flex w-full flex-col items-center justify-center gap-1.5 bg-white/[0.04] ${riempi ? "h-full" : "aspect-video"}`}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white/70">
            {(c.nome || "?").trim().charAt(0).toUpperCase()}
          </span>
          {!!traccia && !traccia.enabled && <span className="text-[9px] text-white/45">camera spenta</span>}
        </div>
      )}
      <span className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-1 bg-gradient-to-t from-black/85 to-transparent px-1.5 py-1 text-[10px] font-medium text-white">
        <span className="min-w-0 flex-1 truncate">{c.mia ? "Tu" : c.nome}</span>
        {/*  «Fuori campo» detto a parole, non solo col colore: uno smorzato e
            basta si legge come «connessione scarsa», che è tutta un'altra cosa
            e fa perdere tempo a cercare un guasto che non c'è. */}
        {c.inOnda === false && <span className="shrink-0 rounded bg-white/15 px-1 text-[9px] text-white/70">fuori</span>}
      </span>
    </div>
  );
}

/** Le camere in onda. In salotto la tua sta in cima e occupa tutta la
 *  larghezza: sei tu che conduci, e chi guarda l'anteprima deve ritrovarsi
 *  senza cercarsi. */
export function GrigliaCamere({
  camere: tutte, salotto, larghezza, onTocco, onMuto, soloChiParla, riempi,
}: {
  camere: Camera[];
  /** riempi la cella invece di imporre un 16:9: vedi `Riquadro` */
  riempi?: boolean;
  salotto?: boolean;
  /** la larghezza dello schermo di chi guarda; assente in console */
  larghezza?: number;
  /** in console: tocca un riquadro per portarlo in primo piano */
  onTocco?: (chiave: string) => void;
  /** in console: apre e chiude il microfono di chi è sul palco */
  onMuto?: (chiave: string, acceso: boolean) => void;
  /** ⚠️ La stessa regola dei relatori, applicata agli OSPITI: acceso, restano
   *  solo quelli che parlano; se non parla nessuno si vedono tutti, o lo
   *  schermo diventerebbe nero a ogni respiro. */
  soloChiParla?: boolean;
}) {
  //  ⚠️ Chi conduce non si nasconde mai: la propria camera resta anche quando
  //   si tace, perché è quella che serve a controllare come si esce.
  const camere = soloChiParla
    ? [...tutte.filter((c) => c.mia), ...chiSiVede(tutte.filter((c) => !c.mia), true)]
    : tutte;
  if (!camere.length) return null;

  //  ── IL PRIMO PIANO COMANDA SULLA POSIZIONE ──────────────────────────
  //  Chi è in primo piano sta sopra e a tutta larghezza, chiunque sia. Senza
  //  primo piano scelto, quel posto è del presentatore: è lui che conduce.
  const scelto = camere.find((c) => c.primoPiano);
  const sopra = scelto ?? (salotto ? camere.find((c) => c.mia) : null);
  const sotto = camere.filter((c) => c !== sopra);

  //  Fuori dal salotto c'è solo la propria: niente griglia, solo l'anteprima.
  if (!salotto) {
    return <div className={`grid grid-cols-1 gap-1.5 ${riempi ? "h-full" : ""}`}>{camere.map((c) => <Riquadro key={c.chiave} c={c} onTocco={onTocco} onMuto={onMuto} riempi={riempi} />)}</div>;
  }

  return (
    <div className={`space-y-1.5 ${riempi ? "h-full" : ""}`}>
      {sopra && <Riquadro key={sopra.chiave} c={sopra} onTocco={onTocco} onMuto={onMuto} riempi={riempi} />}
      {sotto.length > 0 && (
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${colonnePerCamere(sotto.length, larghezza)}, minmax(0, 1fr))` }}
        >
          {sotto.map((c) => (
            <div
              key={c.chiave}
              //  ⚠️ CHI PARLA PRENDE LA RIGA INTERA, come i relatori. Senza,
              //   in un salotto da quattro non si capisce chi ha appena fatto
              //   la domanda — e chi conduce risponde guardando la persona
              //   sbagliata.
              className={c.parla ? "col-span-full transition-all" : "transition-all"}
            >
              <Riquadro c={c} onTocco={onTocco} onMuto={onMuto} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  I TRE FORMATI
// ══════════════════════════════════════════════════════════════════════════

/** Le tre misure di riferimento. Non sono i modelli di telefono di quest'anno:
 *  sono le tre larghezze in cui l'impaginazione del sito cambia davvero — le
 *  stesse soglie che decidono se una pagina si dispone su una colonna o su
 *  tre. Provare a 390 e a 393 non dimostra niente di diverso. */
const FORMATI = [
  { chiave: "telefono", nome: "Telefono", w: 390, h: 844, icona: Smartphone },
  { chiave: "tablet", nome: "Tablet", w: 834, h: 1112, icona: Tablet },
  { chiave: "grande", nome: "Schermo grande", w: 1440, h: 900, icona: Monitor },
] as const;

/** Quanti stanno guardando da ciascuna classe. */
export interface Schermi { telefono: number; tablet: number; grande: number; misure?: string[] }

/** ⚠️ SI APRE DA SOLA, MA UNA VOLTA SOLA E SOLO QUANDO SERVE.
 *  Serve quando in sala ci sono ALMENO DUE classi di schermo: con tutti sullo
 *  stesso formato l'anteprima non aggiunge niente e ruba spazio. Con due o tre,
 *  invece, è l'unico modo di sapere che la tabella che stai per mostrare a
 *  metà sala non si legge.
 *  E una volta sola: riaprirsi da sé dopo che l'hai chiusa è il comportamento
 *  che fa odiare una funzione utile. */
export function useApriAnteprima(schermi: Schermi | null, attiva: boolean): [boolean, (v: boolean) => void] {
  const [aperta, setAperta] = useState(false);
  const giaAperta = useRef(false);
  useEffect(() => {
    if (!attiva || !schermi || giaAperta.current) return;
    const classi = [schermi.telefono, schermi.tablet, schermi.grande].filter((n) => n > 0).length;
    if (classi >= 2) { giaAperta.current = true; setAperta(true); }
  }, [schermi, attiva]);
  return [aperta, setAperta];
}

/** I tre formati affiancati, dal vivo, sulla pagina che sta vedendo la sala.
 *
 *  ⚠️ NON SONO TRE IMMAGINI RIDIMENSIONATE. Ogni riquadro è la pagina vera
 *   caricata a quella larghezza esatta e poi RIMPICCIOLITA con una scala: è la
 *   differenza fra vedere «com'è fatta la pagina su un telefono» e vedere «la
 *   pagina del computer più piccola». La prima mostra il menu che diventa un
 *   panino e la tabella che va a capo; la seconda no, e ti farebbe dire che va
 *   tutto bene. */
export function AnteprimaFormati({
  percorso, schermi, onChiudi,
}: { percorso: string; schermi: Schermi | null; onChiudi: () => void }) {
  if (!percorso) return null;
  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-black/80 p-4" onClick={onChiudi}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0b1426] text-white shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <p className="flex-1 text-sm font-semibold">Come lo stanno vedendo</p>
          {!!schermi?.misure?.length && (
            <p className="hidden text-[11px] text-white/50 sm:block">{schermi.misure.join(" · ")}</p>
          )}
          <button onClick={onChiudi} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10" aria-label="Chiudi">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto p-4 lg:grid-cols-3">
          {FORMATI.map((f) => {
            const quanti = schermi ? schermi[f.chiave] : 0;
            return (
              <div key={f.chiave} className="flex min-h-0 flex-col">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/60">
                  <f.icona className="h-3.5 w-3.5" /> {f.nome}
                  <span className="font-normal normal-case tracking-normal text-white/40">{f.w}×{f.h}</span>
                  {/*  Quante persone stanno guardando davvero da questo
                      formato: è quello che trasforma tre anteprime in una
                      decisione («a undici persone questa tabella non arriva»). */}
                  {quanti > 0 && (
                    <span className="ml-auto rounded bg-brand/25 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-white">
                      {quanti}
                    </span>
                  )}
                </p>
                <Telaio percorso={percorso} w={f.w} h={f.h} spento={quanti === 0} />
              </div>
            );
          })}
        </div>

        <p className="border-t border-white/10 px-4 py-2 text-[11px] text-white/45">
          Sono pagine vere, non fotografie: si aggiornano da sole mentre cambi schermata.
        </p>
      </div>
    </div>
  );
}

/** La pagina caricata alla larghezza esatta e poi rimpicciolita per stare nella
 *  colonna. La scala si misura sul contenitore, così i tre riquadri restano
 *  confrontabili anche su una finestra stretta. */
function Telaio({ percorso, w, h, spento }: { percorso: string; w: number; h: number; spento?: boolean }) {
  const box = useRef<HTMLDivElement | null>(null);
  const [scala, setScala] = useState(0.3);
  useEffect(() => {
    const misura = () => {
      const el = box.current;
      if (!el) return;
      setScala(Math.min(el.clientWidth / w, el.clientHeight / h) || 0.3);
    };
    misura();
    const ro = new ResizeObserver(misura);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [w, h]);

  return (
    <div
      ref={box}
      //  Chi non ha nessuno su questo formato resta visibile ma smorzato: si
      //  guarda comunque volendo, ma l'occhio va dove c'è gente.
      className={`relative min-h-0 flex-1 overflow-hidden rounded-lg border border-white/15 bg-white ${spento ? "opacity-40" : ""}`}
    >
      <iframe
        src={percorso}
        title={`Anteprima a ${w} pixel`}
        //  ⚠️ Larghezza e altezza VERE, e poi si rimpicciolisce: è l'unico modo
        //   perché la pagina dentro creda di essere su quello schermo e si
        //   impagini come farebbe davvero.
        style={{ width: w, height: h, transform: `scale(${scala})`, transformOrigin: "top left" }}
        className="absolute left-0 top-0 border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    </div>
  );
}
