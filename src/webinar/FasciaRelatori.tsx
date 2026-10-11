/** ── LA FASCIA DEI RELATORI ─────────────────────────────────────────────────
 *
 *  Chi conduce sta SEMPRE in primo piano, e occupa sempre la stessa porzione
 *  di schermo: intera se è uno, divisa se sono due, tre, quattro. Non è una
 *  griglia come quella degli ospiti — è una fascia con un posto fisso, e la
 *  differenza conta: chi guarda impara in dieci secondi dove sono le facce che
 *  contano, e da lì in poi non le cerca più.
 *
 *  ── E CHI PARLA SI ALLARGA ────────────────────────────────────────────────
 *  Il riquadro di chi ha la voce cresce, quello degli altri si stringe fin
 *  quasi a sparire. Non spariscono del tutto, e la scelta è voluta: in un
 *  programma a due voci metà del valore è la faccia dell'altro mentre ascolta
 *  — annuisce, ride, alza il sopracciglio — e toglierla del tutto trasforma un
 *  dialogo in due monologhi alternati. Resta una striscia: c'è, e non ruba
 *  spazio.
 *
 *  ── IL LOGO E IL NOME ─────────────────────────────────────────────────────
 *  Come in Meetly: il marchio in un angolo e il nome sotto. Chi entra a metà
 *  diretta — e a un webinar entrano tutti a metà — deve capire senza chiedere
 *  chi sta parlando e per conto di chi.
 */
import { attaccaFlusso } from "@/webinar/attacca";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import { chiSiVede, disposizioneRelatori } from "./griglia";
import { useMisura } from "./misura";
import { riquadroDentro } from "./palco-tetris";

export interface Relatore {
  id: string;
  nome: string;
  stream: MediaStream | null;
  /** la propria: va MUTA (è larsen) e specchiata */
  mia?: boolean;
  parla?: boolean;
}

/** ⚠️ QUANTO SI ALLARGA CHI PARLA. Sei contro uno: a occhio l'altro «sparisce»
 *  — resta una striscia — ma il riquadro non collassa a zero, che farebbe
 *  saltare il video e ripartire la riproduzione a ogni battuta. */
const PESO_PARLA = 6;
const PESO_ASCOLTA = 1;

export function FasciaRelatori({
  relatori: tutti, logo, altezza, soloChiParla, larghezza,
}: {
  relatori: Relatore[];
  /** il marchio dello studio, dalla stessa fonte di Meetly */
  logo?: string;
  /** l'altezza della fascia: fissa, perché il posto delle facce non deve
   *  ballare mentre si parla */
  altezza?: number | string;
  /** acceso: restano solo quelli che parlano. Se non parla nessuno si vedono
   *  comunque tutti — vedi `chiSiVede`, che è dove sta la regola. */
  soloChiParla?: boolean;
  /** la larghezza dello schermo di chi guarda: decide se ci stanno in fila o
   *  se serve una griglia. Assente = si assume un computer. */
  larghezza?: number;
}) {
  //  ⚠️ La scelta di CHI si vede sta in un modulo puro e provato, non qui: è
  //   una riga di logica che, sbagliata, lascia lo schermo nero a ogni respiro
  //   fra una frase e l'altra.
  const relatori = chiSiVede(tutti, !!soloChiParla);
  if (!relatori.length) return null;

  //  Se nessuno parla, tutti uguali: una fascia che si riassesta a ogni
  //  respiro è più fastidiosa di una ferma.
  const qualcunoParla = relatori.some((r) => r.parla);
  //  ⚠️ COME SI DISPONGONO LO DECIDE LA LARGHEZZA VERA dello schermo di chi
  //   guarda, non un numero fisso: la stessa fascia che su un computer è una
  //   fila elegante, su un telefono sarebbe una striscia di francobolli. La
  //   regola sta in `griglia.ts`, provata a parte.
  const { modo, colonne } = disposizioneRelatori(relatori.length, larghezza || 1280);

  if (modo === "riga") {
    const pesi = relatori
      .map((r) => (!qualcunoParla ? 1 : r.parla ? PESO_PARLA : PESO_ASCOLTA))
      .map((p) => `${p}fr`)
      .join(" ");
    return (
      <div
        //  ⚠️ `gridAutoRows` NON È UN DETTAGLIO: senza, la riga si dimensiona
        //   sul contenuto e il riquadro con le proporzioni la sfonda — misurato,
        //   724 punti di riquadro dentro una fascia di 368. Con `minmax(0, 1fr)`
        //   la riga vale esattamente la fascia, e il riquadro si adatta a lei.
        style={{ height: altezza ?? "100%", gridTemplateColumns: pesi, gridAutoRows: "minmax(0, 1fr)" }}
        //  La transizione è sulle COLONNE: il riquadro cresce, il video dentro
        //  non riparte.
        className="grid w-full gap-1.5 transition-[grid-template-columns] duration-500 ease-out"
      >
        {relatori.map((r) => (
          <Riquadro key={r.id} r={r} logo={logo} stretto={qualcunoParla && !r.parla} />
        ))}
      </div>
    );
  }

  //  ── NON CI STANNO IN FILA ────────────────────────────────────────────
  //   Chi parla prende la PRIMA RIGA INTERA, gli altri si dispongono sotto.
  //   È il telefono con tre o più relatori: affiancarli darebbe riquadri in
  //   cui non si riconosce nessuno, e una fascia in cui non si riconosce
  //   nessuno non serve a niente.
  const chiParla = relatori.find((r) => r.parla);
  const sotto = relatori.filter((r) => r !== chiParla);
  return (
    <div style={{ height: altezza ?? "100%" }} className="flex w-full flex-col gap-1.5">
      {!!chiParla && (
        <div className="min-h-0 flex-[2]">
          <Riquadro r={chiParla} logo={logo} stretto={false} />
        </div>
      )}
      <div
        style={{ gridTemplateColumns: `repeat(${colonne}, minmax(0, 1fr))` }}
        className="grid min-h-0 flex-1 gap-1.5"
      >
        {sotto.map((r) => (
          <Riquadro key={r.id} r={r} logo={logo} stretto={!!chiParla} />
        ))}
      </div>
    </div>
  );
}

function Riquadro({ r, logo, stretto }: { r: Relatore; logo?: string; stretto: boolean }) {
  const [, ridisegna] = useState(0);

  /** ── ⚠️ IL RIQUADRO È 16:9 PER CONTO, NON PER CSS ──────────────────────
   *  C'era `height:100%` + `aspect-ratio:16/9` + `max-width:100%`. Sembra la
   *  cosa giusta e non lo è: quando a non bastare è la LARGHEZZA, il browser
   *  tronca la larghezza e TIENE l'altezza — le proporzioni saltano e il video
   *  dentro viene tagliato ai lati. In una colonna stretta usciva un riquadro
   *  IN VERTICALE con dentro una fetta di faccia: si vedeva in regia con due
   *  relatori, e nella fascia della sala ogni volta che le colonne si
   *  stringevano. Con due misure vere e una moltiplicazione — `riquadroDentro`,
   *  provato — il riquadro è 16:9 sempre, in tutti e due i versi.
   *
   *  ⚠️ SI MISURA LA CELLA, non il riquadro: il riquadro riceve una misura
   *   fissa, e misurare lui vorrebbe dire leggere la propria risposta di prima.
   *   La cella invece la decide la griglia, e quello che c'è dentro non la può
   *   gonfiare.
   *
   *  La stessa misura decide anche la targhetta: nella finestrella da ottanta
   *  punti sopra i contenuti il marchio usciva dal bordo e del nome restava
   *  «Filipp…». Un cartellino illeggibile che copre mezza faccia è peggio di
   *  nessun cartellino. */
  const [cellaRif, cella] = useMisura<HTMLDivElement>();
  const scatola = riquadroDentro(cella.larghezza, cella.altezza);
  const minuscolo = scatola.larghezza > 0 && scatola.larghezza < 160;

  //  ⚠️ `ref` a funzione e non effetto legato allo stream: è la stessa lezione
  //   del riquadro delle camere. Cambiando disposizione l'elemento può
  //   rinascere, e un effetto legato a uno stream che NON è cambiato non
  //   riaggancerebbe niente — video nero, senza errori.
  //  ⚠️ ERA UNA COPIA di `attaccaFlusso`, e quando quella ha imparato a
  //   ripiegare sul muto (senza cui il telefono resta nero, vedi webinar/attacca)
  //   questa sarebbe rimasta indietro in silenzio. Adesso è la stessa funzione.
  const aggancia = attaccaFlusso(r.stream, r.mia);

  useEffect(() => {
    const t = r.stream?.getVideoTracks()[0];
    if (!t) return;
    const orologio = setInterval(() => ridisegna((n) => n + 1), 1000);
    return () => clearInterval(orologio);
  }, [r.stream]);

  const traccia = r.stream?.getVideoTracks()[0];
  const conVideo = !!traccia && traccia.enabled && traccia.readyState === "live";

  //  ── ⚠️ IL RIQUADRO TIENE LE PROPORZIONI DELLA CAMERA ────────────────────
  //   Prima riempiva la striscia: su un monitor da 1440 la fascia è larga
  //   quanto lo schermo e alta il 46%, cioè un rettangolo da 3,8:1, e dentro
  //   ci finiva un video 16:9 con `object-cover`. Risultato: di tutta
  //   l'inquadratura si vedeva una FETTA ORIZZONTALE al centro — la faccia
  //   tagliata sopra e sotto, o il soffitto, a seconda di dove punta la
  //   camera. Segnalato con la foto: «troppo stretta l'inquadratura».
  //   Adesso il riquadro è alto quanto la fascia e largo quanto serve per
  //   restare 16:9, centrato. Quando la colonna è più stretta di così, è la
  //   larghezza a comandare e l'altezza scende: le proporzioni non si perdono
  //   in nessuno dei due versi.
  //  ⚠️ Il contenitore che centra è SEPARATO dal riquadro. Mettere il
  //   centraggio sullo stesso elemento che ha il bordo e il video vorrebbe
  //   dire far cambiare dimensione all'elemento che contiene il <video>, e un
  //   <video> che cambia scatola a ogni battuta riparte da capo.
  return (
    <div ref={cellaRif} className="flex h-full min-h-0 min-w-0 items-center justify-center">
    <div
      className={`relative overflow-hidden rounded-xl border bg-black/60 transition ${
        r.parla ? "border-emerald-400/70" : "border-white/10"
      }`}
      //  Finché la cella non è misurata resta la strada di riserva: larga
      //  quanto c'è e alta di conseguenza. Meglio un istante di proporzioni
      //  approssimate che un riquadro di misura zero.
      style={
        scatola.larghezza
          ? { width: scatola.larghezza, height: scatola.altezza }
          : { width: "100%", aspectRatio: "16 / 9" }
      }
    >
      {conVideo ? (
        <video
          ref={aggancia}
          playsInline
          autoPlay
          muted={r.mia}
          className={`h-full w-full bg-black object-cover ${r.mia ? "-scale-x-100" : ""}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-white/[0.04]">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-base font-semibold text-white/70">
            {(r.nome || "?").trim().charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      {/* ── IL MARCHIO ────────────────────────────────────────────────────
          In alto a sinistra come in Meetly. Sparisce quando il riquadro è
          stretto: su una striscia larga due dita coprirebbe la faccia, che è
          l'unica cosa che quel riquadro deve ancora mostrare. */}
      {!!logo && !stretto && !minuscolo && (
        <img
          src={logo}
          alt=""
          className="pointer-events-none absolute left-2 top-2 h-5 w-auto opacity-80 drop-shadow-[0_1px_3px_rgba(0,0,0,.8)]"
        />
      )}

      {/* ── IL NOME ───────────────────────────────────────────────────────
          Resta SEMPRE, anche sulla striscia: a un webinar si entra a metà, e
          chi entra deve capire chi sta parlando senza chiederlo in chat. */}
      <span
        className={`absolute inset-x-0 bottom-0 flex items-center bg-gradient-to-t from-black/85 to-transparent ${
          minuscolo ? "gap-1 px-1.5 py-1" : "gap-1.5 px-2 py-1.5"
        }`}
      >
        {r.parla && (
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
          </span>
        )}
        <span
          className={`min-w-0 truncate font-medium text-white ${
            minuscolo ? "text-[9px]" : stretto ? "text-[10px]" : "text-[13px]"
          }`}
        >
          {r.mia ? "Tu" : r.nome}
        </span>
      </span>
    </div>
    </div>
  );
}

/** Il marchio dello studio. Stessa fonte del logo che si vede in tutta
 *  l'applicazione e sui documenti: `api/presenter/brand`. Un secondo posto da
 *  cui prenderlo avrebbe voluto dire un webinar con un logo diverso dal resto. */
export function useLogoStudio(): string {
  const [logo, setLogo] = useState("");
  const fatto = useRef(false);
  useEffect(() => {
    if (fatto.current) return;
    fatto.current = true;
    void fetch("/api/presenter/brand")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setLogo(String(j?.logoUrl || "")))
      .catch(() => setLogo(""));
  }, []);
  return logo;
}

/** ── SPOSTARE LA FASCIA ─────────────────────────────────────────────────────
 *  Quando i relatori stanno SOPRA i contenuti, il loro riquadro copre un pezzo
 *  di quello che si sta mostrando — e quale pezzo dipende dalla slide. Poterlo
 *  spostare è l'unico modo per non dover scegliere fra vedere la faccia e
 *  vedere il numero che sta sotto.
 *
 *  ⚠️ LA POSIZIONE SI RICORDA, ed è personale: chi guarda dal telefono lo
 *   mette in un angolo diverso da chi guarda dal computer, e ritrovarlo dove
 *   lo si era lasciato è la differenza fra uno strumento e un aggeggio da
 *   risistemare ogni volta.
 *  ⚠️ E SI RIPORTA DENTRO da sola: girando il telefono o rimpicciolendo la
 *   finestra, una posizione salvata in pixel finirebbe fuori schermo, e il
 *   riquadro sparirebbe senza modo di riprenderlo.
 */
export function useTrascinabile(chiave: string, iniziale: { x: number; y: number }) {
  /** ── ⚠️ SI RICORDA LA PROPORZIONE, NON I PUNTI ─────────────────────────
   *  Si salvavano le coordinate così com'erano. Funziona finché lo schermo è
   *  sempre quello, e non lo è mai: la stessa persona apre la diretta dal
   *  telefono e poi dal tablet, o semplicemente gira il telefono. Una bolla
   *  messa nell'angolo in basso a destra di un telefono — 243 punti su 375 —
   *  su un tablet da 768 si ritrova in MEZZO alla pagina, sopra il testo. L'ho
   *  vista lì.
   *  Salvando invece «quanto in là» e «quanto in giù» da zero a uno, l'angolo
   *  resta l'angolo su qualunque schermo, e il centro resta il centro.
   *  ⚠️ Le vecchie posizioni in punti si buttano: convertirle vorrebbe dire
   *   indovinare su quale schermo erano state salvate. Si riparte dall'angolo,
   *   che è dove starebbero comunque quasi tutte. */
  //  ⚠️ «Qualcuno l'ha davvero messa lì?» Serve a chi disegna: finché la
  //   risposta è no, l'angolo lo deve tenere il CSS (`bottom`/`right`) e non
  //   un paio di numeri. Calcolare l'angolo da `window.innerWidth` sembra
  //   equivalente e non lo è: se in quel momento la finestra non è ancora
  //   misurata — scheda in secondo piano, pagina ripresa dalla memoria del
  //   browser — quel conto dà zero, e la bolla nasce in alto a sinistra sopra
  //   il marchio. L'ho vista lì.
  const [scelta, setScelta] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const v = JSON.parse(localStorage.getItem(chiave) || "null");
      return !!v && Number.isFinite(v.fx) && Number.isFinite(v.fy);
    } catch { return false; }
  });

  const [pos, setPos] = useState(() => {
    if (typeof window === "undefined") return iniziale;
    try {
      const v = JSON.parse(localStorage.getItem(chiave) || "null");
      if (v && Number.isFinite(v.fx) && Number.isFinite(v.fy)) {
        return {
          x: Math.round(v.fx * Math.max(0, window.innerWidth - 160)),
          y: Math.round(v.fy * Math.max(0, window.innerHeight - 160)),
        };
      }
    } catch { /* posizione illeggibile: si riparte da quella di partenza */ }
    return iniziale;
  });
  const preso = useRef<{ dx: number; dy: number } | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  /** ⚠️ SI SCRIVE IN MEMORIA SOLO DOPO UN TRASCINAMENTO VERO. Prima si salvava
   *  a ogni cambio di posizione — compresa quella di partenza e quella
   *  rimessa dentro lo schermo dopo una rotazione. Bastava un giro in cui la
   *  finestra era di una misura diversa perché la proporzione salvata
   *  diventasse un'altra, e la volta dopo la bolla si ritrovava in un angolo
   *  che nessuno aveva scelto: l'ho vista finire in alto a sinistra, mezza
   *  fuori dallo schermo, sopra il marchio. Una posizione «ricordata» che
   *  nessuno ha mai deciso è peggio di nessuna memoria. */
  const trascinata = useRef(false);

  const dentro = (p: { x: number; y: number }) => {
    const el = box.current;
    const w = el?.offsetWidth ?? 200;
    const h = el?.offsetHeight ?? 120;
    //  Si lascia sempre un pezzo visibile: bloccarlo del tutto dentro impedisce
    //  di appoggiarlo al bordo, lasciarlo uscire lo fa sparire.
    return {
      x: Math.max(8, Math.min(window.innerWidth - w - 8, p.x)),
      y: Math.max(8, Math.min(window.innerHeight - h - 8, p.y)),
    };
  };

  useEffect(() => {
    //  Si segue su `window`: tirando in fretta il dito esce dal riquadro, e gli
    //  eventi attaccati a lui smetterebbero di arrivare a metà trascinamento.
    const muovi = (e: PointerEvent) => {
      const p = preso.current;
      if (!p) return;
      e.preventDefault();
      setPos(dentro({ x: e.clientX - p.dx, y: e.clientY - p.dy }));
    };
    const molla = () => { preso.current = null; };
    window.addEventListener("pointermove", muovi, { passive: false });
    window.addEventListener("pointerup", molla);
    window.addEventListener("pointercancel", molla);
    const riporta = () => setPos((v) => dentro(v));
    //  ⚠️ Una volta ANCHE ADESSO, non solo quando la finestra cambia: la
    //   posizione che arriva dalla memoria è stata salvata su uno schermo che
    //   può essere di un'altra misura, e senza questo giro può cadere a
    //   cavallo del bordo. Si aspetta un disegno perché prima il riquadro non
    //   ha ancora una larghezza da cui partire.
    const primoGiro = setTimeout(riporta, 0);
    window.addEventListener("resize", riporta);
    window.addEventListener("orientationchange", riporta);
    return () => {
      clearTimeout(primoGiro);
      window.removeEventListener("pointermove", muovi);
      window.removeEventListener("pointerup", molla);
      window.removeEventListener("pointercancel", molla);
      window.removeEventListener("resize", riporta);
      window.removeEventListener("orientationchange", riporta);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !trascinata.current) return;
    //  ⚠️ In proporzione: il perché sta sopra, dove si rilegge.
    const larghi = Math.max(1, window.innerWidth - 160);
    const alti = Math.max(1, window.innerHeight - 160);
    const f = {
      fx: Math.min(1, Math.max(0, pos.x / larghi)),
      fy: Math.min(1, Math.max(0, pos.y / alti)),
    };
    try { localStorage.setItem(chiave, JSON.stringify(f)); } catch { /* pazienza */ }
  }, [chiave, pos]);

  const maniglia = {
    onPointerDown: (e: React.PointerEvent) => {
      const r = box.current?.getBoundingClientRect();
      //  ⚠️ Da qui in poi conta la posizione in punti, e non più l'angolo: si
      //   parte da DOVE STA ADESSO, misurato, altrimenti al primo tocco la
      //   bolla salterebbe dall'angolo alle coordinate di partenza.
      setPos({ x: Math.round(r?.left ?? 0), y: Math.round(r?.top ?? 0) });
      setScelta(true);
      preso.current = { dx: e.clientX - (r?.left ?? 0), dy: e.clientY - (r?.top ?? 0) };
      trascinata.current = true;
    },
  };

  return { box, pos, maniglia, scelta };
}
