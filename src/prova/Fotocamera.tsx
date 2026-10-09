/** ── SCATTARE LA FOTO, GUIDATI ─────────────────────────────────────────────
 *
 *  Si apre la fotocamera a tutto schermo, con un ovale al centro dove mettere
 *  il viso e una riga per volta che dice cosa fare. Si scatta, si guarda, e se
 *  non va bene si rifà.
 *
 *  ── ⚠️ PERCHÉ NON BASTA «CARICA UNA FOTO» ────────────────────────────────
 *  Metà delle foto che arrivano sono inutilizzabili sempre per gli stessi tre
 *  motivi: viso troppo piccolo, controluce, testa girata. Il risultato esce
 *  storto, e chi guarda pensa che sia il programma a non funzionare — non la
 *  sua foto. Guidare lo scatto costa una schermata e toglie via la maggior
 *  parte dei risultati brutti prima che esistano.
 *
 *  ── ⚠️ È FATTA PER CHI NON HA DIMESTICHEZZA ──────────────────────────────
 *  Un solo comando grande in fondo, l'ovale che diventa verde quando sei nel
 *  punto giusto, e le indicazioni una alla volta invece di un elenco. Chi ha
 *  sessant'anni e una mano sola libera deve poterci arrivare senza chiedere.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, RotateCcw, SwitchCamera, X } from "lucide-react";
import { spiegaErroreMedia } from "@/webinar/errori-media";

/** ── ⚠️ IL VISO SI RICONOSCE SOLO DOVE SI PUÒ ─────────────────────────────
 *  `FaceDetector` esiste su Chrome e su Android, non su Safari e non su
 *  iPhone. Dove c'è, l'ovale diventa un semaforo vero: rosso finché non sei
 *  nella posizione giusta, verde quando ci sei, e prima del verde non si
 *  scatta. Dove NON c'è, bloccare lo scatto sarebbe una porta chiusa in
 *  faccia a metà dei telefoni: lì resta la guida — l'ovale, i consigli — e si
 *  scatta quando si vuole. Meglio una guida senza semaforo che un pulsante
 *  spento per sempre. */
type Riquadro = { x: number; y: number; width: number; height: number };
type Occhi = Array<{ locations?: Array<{ x: number; y: number }>; type?: string }>;
interface Rilevatore { detect: (v: HTMLVideoElement) => Promise<Array<{ boundingBox: Riquadro; landmarks?: Occhi }>> }

/** Com'è messo il viso adesso, e cosa dire di conseguenza. */
type Verdetto =
  | { stato: "cerco"; dice: string }
  | { stato: "lontano"; dice: string }
  | { stato: "vicino"; dice: string }
  | { stato: "storto"; dice: string }
  | { stato: "ok"; dice: string };

/** Le tre cose che rovinano una foto, dette una alla volta e a rotazione: un
 *  elenco di tre righe non lo legge nessuno mentre si tiene il telefono in
 *  mano. */
const CONSIGLI = [
  "Metti il viso dentro l'ovale",
  "Tieni il telefono all'altezza degli occhi",
  "Guarda dritto nell'obiettivo",
  "Luce davanti a te, non alle spalle",
  "Niente cappello né occhiali da sole",
];

export function Fotocamera({
  onScattata, onChiudi,
}: {
  onScattata: (dataUrl: string) => void;
  onChiudi: () => void;
}) {
  const video = useRef<HTMLVideoElement | null>(null);
  const flusso = useRef<MediaStream | null>(null);
  const [errore, setErrore] = useState("");
  const [pronta, setPronta] = useState(false);
  const [davanti, setDavanti] = useState(true);
  const [consiglio, setConsiglio] = useState(0);
  const [scatto, setScatto] = useState("");
  /** Il semaforo. `null` = questo telefono non sa riconoscere il viso. */
  const [verdetto, setVerdetto] = useState<Verdetto | null>(null);
  const [riconosce, setRiconosce] = useState(false);
  /** Quanto è pieno l'ovale, da 0 a 1: serve all'animazione che si apre e si
   *  chiude seguendo la distanza. */
  const [pienezza, setPienezza] = useState(0);

  const spegni = useCallback(() => {
    flusso.current?.getTracks().forEach((t) => t.stop());
    flusso.current = null;
  }, []);

  const accendi = useCallback(async (frontale: boolean) => {
    setErrore("");
    setPronta(false);
    spegni();
    try {
      //  ⚠️ `ideal` e non `exact`: su molti telefoni la camera frontale non
      //   arriva a 1280 e con `exact` la richiesta fallisce del tutto — cioè
      //   schermo nero invece di una foto un po' più piccola.
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: frontale ? "user" : "environment",
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      });
      flusso.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play().catch(() => { /* parte al primo tocco */ });
      }
      setPronta(true);
    } catch (e) {
      const nome = (e as { name?: string })?.name || "";
      setErrore(spiegaErroreMedia(nome, true).testo);
    }
  }, [spegni]);

  useEffect(() => {
    void accendi(davanti);
    return spegni;
  }, [davanti, accendi, spegni]);

  //  I consigli girano da soli: uno ogni tre secondi, che è il tempo di
  //  leggerne uno e sistemarsi. ⚠️ Solo finché il semaforo non c'è o è rosso:
  //  quando sei nella posizione giusta l'unica cosa da dire è «scatta».
  useEffect(() => {
    const t = setInterval(() => setConsiglio((v) => (v + 1) % CONSIGLI.length), 3000);
    return () => clearInterval(t);
  }, []);

  /** ── IL SEMAFORO ─────────────────────────────────────────────────────────
   *  Tre volte al secondo si guarda dov'è il viso e quanto è grande, e si
   *  decide una cosa sola: si può scattare o no.
   *  ⚠️ LE SOGLIE SONO LARGHE APPOSTA. Strette, il verde non arriva mai e la
   *   persona resta a muovere il telefono finché si stufa — che è peggio di
   *   una foto un po' storta. Si chiede: viso grande abbastanza da vedere i
   *   capelli, dentro l'ovale, e occhi all'incirca alla stessa altezza (è
   *   quello che distingue una faccia di fronte da una girata).
   *  ⚠️ E il verde deve REGGERE mezzo secondo prima di accendersi: senza,
   *   lampeggia a ogni respiro e il pulsante balla sotto il dito. */
  useEffect(() => {
    if (!pronta || scatto) return;
    const Fabbrica = (window as unknown as { FaceDetector?: new (o: unknown) => Rilevatore }).FaceDetector;
    if (!Fabbrica) { setRiconosce(false); setVerdetto(null); return; }
    setRiconosce(true);
    const rilevatore = new Fabbrica({ fastMode: true, maxDetectedFaces: 1 });
    let vivo = true;
    let buonoDa = 0;

    const guarda = async () => {
      const v = video.current;
      if (!vivo || !v || !v.videoWidth) return;
      try {
        const visi = await rilevatore.detect(v);
        const f = visi[0];
        if (!f) {
          buonoDa = 0;
          setPienezza(0);
          setVerdetto({ stato: "cerco", dice: "Mettiti davanti alla fotocamera" });
          return;
        }
        const lato = Math.min(v.videoWidth, v.videoHeight);
        const quanto = f.boundingBox.height / lato;
        setPienezza(Math.min(1, quanto / 0.62));

        //  Fuori centro: l'ovale è al centro, e un viso di lato esce storto.
        const cx = (f.boundingBox.x + f.boundingBox.width / 2) / v.videoWidth;
        const cy = (f.boundingBox.y + f.boundingBox.height / 2) / v.videoHeight;
        const centrato = Math.abs(cx - 0.5) < 0.16 && Math.abs(cy - 0.5) < 0.18;

        //  Di fronte o girato: gli occhi di una faccia frontale stanno alla
        //  stessa altezza e a distanza simile dal centro. Se il telefono non
        //  dà i punti del viso non si può dire, e non si pretende.
        const punti = (f.landmarks || []).filter((p) => p.type === "eye");
        let dritto = true;
        if (punti.length === 2) {
          const [a, b] = punti.map((p) => p.locations?.[0]).filter(Boolean) as Array<{ x: number; y: number }>;
          if (a && b) {
            const dx = Math.abs(a.x - b.x) || 1;
            dritto = Math.abs(a.y - b.y) / dx < 0.28;
          }
        }

        let d: Verdetto;
        if (quanto < 0.34) d = { stato: "lontano", dice: "Avvicina un po' il telefono" };
        else if (quanto > 0.78) d = { stato: "vicino", dice: "Allontana un po' il telefono" };
        else if (!centrato) d = { stato: "storto", dice: "Porta il viso al centro dell'ovale" };
        else if (!dritto) d = { stato: "storto", dice: "Guarda dritto nell'obiettivo" };
        else d = { stato: "ok", dice: "Così va bene — puoi scattare" };

        //  ⚠️ Mezzo secondo di verde prima di accenderlo davvero.
        if (d.stato === "ok") {
          if (!buonoDa) buonoDa = Date.now();
          if (Date.now() - buonoDa < 500) d = { stato: "cerco", dice: "Fermo un attimo…" };
        } else {
          buonoDa = 0;
        }
        setVerdetto(d);
      } catch {
        //  Un rilevatore che si pianta non deve bloccare la fotocamera: si
        //  smette di guardare e si torna alla guida senza semaforo.
        vivo = false;
        setRiconosce(false);
        setVerdetto(null);
      }
    };

    const t = setInterval(() => void guarda(), 300);
    return () => { vivo = false; clearInterval(t); };
  }, [pronta, scatto]);

  const verde = verdetto?.stato === "ok";
  /** ── ⚠️ TRE COLORI, E IL PRIMO È NEUTRO ────────────────────────────────
   *  Partiva rosso: si apriva la fotocamera e la prima cosa che si vedeva era
   *  un allarme, prima ancora di essersi messi davanti. Rosso vuol dire «stai
   *  sbagliando», e non si può dire a qualcuno che deve ancora cominciare.
   *  · neutro  — sto cercando il viso, o questo telefono non lo riconosce;
   *  · rosso   — ti vedo, ma sei troppo lontano, storto o fuori centro;
   *  · verde   — così va bene.
   *  Il rosso è un'informazione solo DOPO che il viso è stato trovato. */
  const semaforo: "neutro" | "rosso" | "verde" =
    !riconosce || !verdetto || verdetto.stato === "cerco" ? "neutro" : verde ? "verde" : "rosso";

  const scatta = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    //  ⚠️ SI RITAGLIA UN QUADRATO AL CENTRO, come l'ovale che si vedeva: se
    //   si salvasse il fotogramma intero, la foto conterrebbe mezza stanza e
    //   il viso sarebbe un francobollo — cioè esattamente il difetto che
    //   questa schermata esiste per togliere.
    const lato = Math.min(v.videoWidth, v.videoHeight);
    const tela = document.createElement("canvas");
    tela.width = lato;
    tela.height = lato;
    const ctx = tela.getContext("2d");
    if (!ctx) return;
    if (davanti) {
      //  Lo specchio si toglie: ci si vede specchiati mentre ci si inquadra
      //  (è quello che fa sembrare naturale il movimento), ma la fotografia
      //  salvata deve essere dritta.
      ctx.translate(lato, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, (v.videoWidth - lato) / 2, (v.videoHeight - lato) / 2, lato, lato, 0, 0, lato, lato);
    setScatto(tela.toDataURL("image/jpeg", 0.9));
  };

  return (
    <div className="fixed inset-0 z-[130] flex flex-col bg-black text-white">
      {/* ── LA TESTATA ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button onClick={onChiudi} className="rounded-full bg-white/10 p-2 transition hover:bg-white/20" aria-label="Chiudi">
          <X className="h-4 w-4" />
        </button>
        <p className="min-w-0 flex-1 text-center text-sm font-semibold">
          {scatto ? "Va bene questa?" : "Inquadra il viso"}
        </p>
        {!scatto ? (
          <button
            onClick={() => setDavanti((v) => !v)}
            className="rounded-full bg-white/10 p-2 transition hover:bg-white/20"
            aria-label="Cambia fotocamera"
          >
            <SwitchCamera className="h-4 w-4" />
          </button>
        ) : (
          <span className="h-8 w-8" />
        )}
      </div>

      {/* ── L'IMMAGINE ────────────────────────────────────────────────── */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {scatto ? (
          <img src={scatto} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <>
            <video
              ref={video}
              playsInline
              muted
              className={`h-full w-full object-cover ${davanti ? "scale-x-[-1]" : ""}`}
            />
            {/* ── ⚠️ L'OVALE È IL COMANDO PIÙ IMPORTANTE DELLA SCHERMATA ──
                  Non è una decorazione: è l'unica istruzione che si capisce
                  senza leggere. Chi mette la faccia dentro l'ovale fa da solo
                  la distanza giusta, l'altezza giusta e l'inquadratura giusta,
                  che sono le tre cose che rovinano le foto.
                 ⚠️ `pointer-events-none`: sopra c'è il video e sotto il tasto
                  di scatto, e un ovale che intercetta i tocchi è un tasto che
                  non si preme. */}
            {/* ── ⚠️ L'OVALE È IL SEMAFORO ──────────────────────────────
                  Rosso finché non sei nella posizione giusta, verde quando ci
                  sei. È l'unica istruzione che si capisce senza leggere, e
                  senza sapere l'italiano.
                 ⚠️ E RESPIRA con la distanza: si allarga quando ti avvicini,
                  si stringe quando ti allontani. Non è un vezzo — è il modo di
                  far capire in che direzione muoversi a chi non ha letto la
                  riga scritta sotto. */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={`relative rounded-[50%] border-[3px] transition-all duration-500 ease-out ${
                  semaforo === "verde"
                    ? "border-emerald-400 shadow-[0_0_0_100vmax_rgba(0,0,0,0.62),0_0_50px_rgba(52,211,153,0.5)]"
                    : semaforo === "rosso"
                      ? "border-rose-400/85 shadow-[0_0_0_100vmax_rgba(0,0,0,0.62),0_0_30px_rgba(251,113,133,0.28)]"
                      : "border-white/45 shadow-[0_0_0_100vmax_rgba(0,0,0,0.62)]"
                }`}
                style={{
                  //  L'ovale segue il viso: parte al 62% e cresce fino al 72%
                  //  quando il viso riempie l'inquadratura.
                  height: `${58 + pienezza * 12}%`,
                  width: `${70 + pienezza * 10}%`,
                  maxWidth: "23rem",
                }}
              >
                {/*  ⚠️ I quattro angoli, come nel mirino di una fotocamera
                    seria: dicono «questo è il punto» senza una parola, e sono
                    l'unica decorazione che qui ci sta. Si accendono col
                    semaforo, così il colore si legge anche a occhio distratto. */}
                {/*  ⚠️ FUORI dall'ovale, non dentro: appoggiati sul bordo si
                    incrociavano con la curva e sembravano un disegno sbagliato.
                    Staccati di un dito, invece, fanno il mirino. */}
                {[
                  "-left-4 -top-2 border-l-2 border-t-2 rounded-tl-2xl",
                  "-right-4 -top-2 border-r-2 border-t-2 rounded-tr-2xl",
                  "-left-4 -bottom-2 border-l-2 border-b-2 rounded-bl-2xl",
                  "-right-4 -bottom-2 border-r-2 border-b-2 rounded-br-2xl",
                ].map((dove) => (
                  <span
                    key={dove}
                    className={`absolute h-9 w-9 transition-colors duration-500 ${dove} ${
                      semaforo === "verde" ? "border-emerald-300"
                        : semaforo === "rosso" ? "border-rose-300/70"
                        : "border-white/35"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/*  ⚠️ La spunta verde compare SOPRA l'ovale e non in un angolo:
                è la risposta alla domanda «sono a posto?», e va dove sta
                guardando chi se la fa — cioè la propria faccia. */}
            {verde && (
              <span className="pointer-events-none absolute left-1/2 top-[10%] flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 duration-300 animate-in zoom-in">
                <Check className="h-6 w-6 text-white" strokeWidth={3} />
              </span>
            )}

            {pronta && (
              <p className={`pointer-events-none absolute bottom-4 left-1/2 w-[min(90%,26rem)] -translate-x-1/2 rounded-full px-4 py-2.5 text-center text-sm font-semibold backdrop-blur transition duration-300 ${
                semaforo === "verde" ? "bg-emerald-500/90 text-white"
                  : semaforo === "rosso" ? "bg-rose-500/85 text-white"
                  : "bg-black/60 text-white/90"
              }`}>
                {verdetto ? verdetto.dice : CONSIGLI[consiglio]}
              </p>
            )}
            {!!errore && (
              <div className="absolute inset-x-4 top-4 rounded-2xl bg-rose-500/15 p-4 text-center text-sm text-rose-100 backdrop-blur">
                {errore}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── I COMANDI ─────────────────────────────────────────────────── */}
      <div className="px-5 pb-6 pt-4">
        {scatto ? (
          <div className="mx-auto flex max-w-sm gap-2.5">
            <button
              onClick={() => setScatto("")}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/20 py-4 font-semibold text-white/80 transition hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" /> Rifalla
            </button>
            <button
              onClick={() => { onScattata(scatto); spegni(); }}
              className="hg-shine flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-500 py-4 font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400"
            >
              Usa questa
            </button>
          </div>
        ) : (
          //  ⚠️ UN CERCHIO GRANDE E BASSO, come su qualunque fotocamera: è
          //   l'unico gesto di questa schermata, e il pollice ci arriva senza
          //   spostare la mano che tiene il telefono.
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={scatta}
              //  ⚠️ Finché il semaforo è rosso NON si scatta: una foto storta
              //   la si scopre trenta secondi dopo, quando il risultato esce
              //   male — e a quel punto sembra che sia il programma a non
              //   funzionare. Dove il viso non si riconosce il pulsante è
              //   sempre attivo: lì bloccare vorrebbe dire una porta chiusa.
              disabled={!pronta || (riconosce && !verde)}
              className={`flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full transition-all duration-300 active:scale-95 disabled:cursor-not-allowed ${
                verde
                  ? "bg-white shadow-[0_0_0_7px_rgba(52,211,153,0.35),0_0_30px_rgba(52,211,153,0.4)]"
                  : !riconosce
                    ? "bg-white shadow-[0_0_0_6px_rgba(255,255,255,0.18)]"
                    : "bg-white/25 shadow-[0_0_0_5px_rgba(255,255,255,0.05)]"
              }`}
              aria-label="Scatta"
            >
              <Camera className="h-7 w-7 text-slate-900" />
            </button>
            {riconosce && !verde && (
              <p className="text-[12px] text-white/40">
                {semaforo === "rosso" ? "Sistemati nell'ovale per scattare" : "Ti sto cercando…"}
              </p>
            )}
          </div>
        )}
        {/*  ⚠️ Anche qui la firma: questa schermata copre tutto, e senza una
            riga in fondo si perde di vista dove si è finiti — proprio mentre
            si sta inquadrando la propria faccia, che è il momento in cui uno
            si chiede «ma chi la vede questa?». */}
        <p className="mt-5 text-center text-[10px] uppercase tracking-[0.16em] text-white/25">
          powered by Hair Genius Labs
        </p>
      </div>
    </div>
  );
}
