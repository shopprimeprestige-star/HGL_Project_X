/** ── IL WEBINAR, CONDOTTO DA DENTRO MEETLY ──────────────────────────────────
 *
 *  Due pezzi, e nessuno dei due sta dentro `shop/`:
 *   · `PopupTrasmissione` — la scelta che compare premendo «Avvia
 *     trasmissione»: consulenza a due, oppure una delle sale create dal
 *     gestionale.
 *   · `ConsoleSala` — il pannello semitrasparente che resta a galla sopra la
 *     postazione mentre si trasmette.
 *
 *  ── PERCHÉ SI TRASMETTE LO SCHERMO E NON SI SINCRONIZZANO LE PAGINE ───────
 *  Nella consulenza a due il cliente SEGUE il presentatore: cambi pagina tu e
 *  cambia anche a lui, perché siete in due su un canale che regge due.
 *  In una sala da centinaia quel canale non regge — è lo stesso muro per cui
 *  il video non poteva restare in mesh — e replicare la navigazione a
 *  cinquecento persone vorrebbe dire un protocollo nuovo, con i suoi ritardi e
 *  i suoi disallineamenti: gente che vede la slide 4 mentre tu parli della 6.
 *  Trasmettendo lo schermo, invece, quello che mostri ARRIVA COM'È: preventivo,
 *  slide, media, siti, il configuratore mentre lo compili. Tutte le funzioni
 *  della consulenza, senza inventare niente che possa disallinearsi. Ed è come
 *  funzionano i webinar veri.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import { toast } from "sonner";
import {
  ChevronDown, Circle, Copy, Hand, LayoutPanelLeft, Loader2, MessageSquare, Mic, MicOff,
  FileText, Globe, Images, Minus, MonitorSmartphone, MonitorUp, PhoneCall, Presentation, Radio,
  LayoutGrid, ScrollText, Send, SlidersHorizontal, Square, Users, Video, VideoOff, X,
  Stethoscope, Eye, EyeOff, RotateCw,
} from "lucide-react";
import { ChatSala, ElencoPalco, type ComandiChat } from "./ChatSala";
import { PannelloPersona, type ComandiPersona } from "./PannelloPersona";
import { Teleprompter } from "./Teleprompter";
import { impostaModo, useModo } from "./modo";
import { sorvegliaVoce, vaiInOnda } from "./sfu";
import { attaccaFlusso } from "./attacca";
import { salaDeiContenuti } from "./contenuti";
import { archivia, avviaRegistrazione, type Registrazione } from "./registrazione";
import { chiVaInOnda, type InPalco, type MessaggioChat, type RegiaPalco, type VistaWebinar } from "./tipi";
import { AnteprimaFormati, GrigliaCamere, useApriAnteprima, useLarghezza, type Camera, type Schermi } from "./Anteprime";
import { FasciaRelatori, useLogoStudio, type Relatore } from "./FasciaRelatori";
import { PannelloDiagnostica } from "./PannelloDiagnostica";
import { useMisura } from "./misura";
import { SpecchioSala } from "./SpecchioSala";
import { useVersioneVecchia } from "./versione";
import { conGrande, conInOnda, conSoloIo, conTutti, elencoRegia } from "./regia-palco";
import { percorsoDaMandare } from "./schermo";
import type { Dispositivo } from "./dispositivo";
import { disponiPalco, riquadroDentro, duello } from "./palco-tetris";
import type { FattiPersona } from "./diagnostica-palco";

/** ── QUALE VERSIONE STA GIRANDO DAVVERO ────────────────────────────────────
 *  ⚠️ SERVE PIÙ DI QUANTO SEMBRI. Un difetto già corretto e già pubblicato può
 *   restare a schermo per ore, perché il browser tiene in cache il pezzo
 *   vecchio: e allora si corregge una seconda volta una cosa che era già
 *   giusta. È successo — la fascia della camera era già corretta in produzione
 *   mentre la foto mostrava ancora quella di prima.
 *  Non è un numero scritto a mano (si dimentica di aggiornarlo): è l'impronta
 *  che Vite mette nel nome di questo stesso file a ogni pubblicazione. Se il
 *  pannello ne mostra una diversa da quella pubblicata, il problema è la cache
 *  e non il programma. */
const VERSIONE = (() => {
  try {
    const m = /([A-Za-z0-9_-]{6,})\.js/.exec(String(import.meta.url));
    return m ? m[1].slice(-10) : "sviluppo";
  } catch { return "sconosciuta"; }
})();
import { statoDiretta } from "./sfu";

async function chiedi(corpo: unknown) {
  const r = await fetch("/api/crm/webinar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(String(j?.error || `errore ${r.status}`));
  return j;
}

// ══════════════════════════════════════════════════════════════════════════
//  LA SCELTA
// ══════════════════════════════════════════════════════════════════════════

interface Sala { codice: string; titolo: string; link: string }

/** ── LE QUATTRO COSE CHE SI MOSTRANO ───────────────────────────────────────
 *  Sono le stesse quattro della barra del presentatore, con gli stessi
 *  indirizzi: qui non si inventa una seconda navigazione, si offre la stessa a
 *  portata di mano mentre lo studio copre lo schermo. */
const CONTENUTI = [
  { percorso: "/slide", testo: "Slide", icona: Presentation },
  { percorso: "/preventivo", testo: "Preventivo", icona: FileText },
  { percorso: "/presenta", testo: "Media", icona: Images },
  { percorso: "/web", testo: "Link", icona: Globe },
] as const;

/** ── LE TRE SCHERMATE, AFFIANCATE E VIVE ───────────────────────────────────
 *  ⚠️ Una sola comanda. Quella del computer porta `?regia=`, cioè PUBBLICA
 *   quello che fai; le altre due portano `?webinar=`, cioè guardano come la
 *   sala. Tre cornici che pubblicano insieme si sovrascriverebbero a vicenda e
 *   nella sala arriverebbe l'ultima che ha parlato.
 *  ⚠️ Una scala sola per tutte e tre: rimpicciolire il monitor e ingrandire il
 *   telefono per farli sembrare uguali toglierebbe l'unica cosa che si viene a
 *   cercare qui — quanto è stretto davvero il telefono.
 */
/** ── UNA SCHERMATA SOLA, A TUTTO SCHERMO ───────────────────────────────────
 *  ⚠️ Scelto il dispositivo dalla barra, quello si prende tutta la scena: è la
 *   schermata su cui si lavora, e lavorarci dentro una miniatura è la ragione
 *   per cui prima si sbagliavano i tocchi. Quello che si fa qui arriva a
 *   TUTTA la sala — non solo a chi ha quel dispositivo: si sceglie la forma
 *   con cui lavorare, non il pubblico a cui parlare.
 *  ⚠️ Il computer non si scala: alla sua misura ci sta già, e scalarlo
 *   vorrebbe dire testo più piccolo del vero per niente. Tablet e telefono
 *   invece si adattano all'altezza della scena, che è quello che manca loro.
 */
function SchermataSola({ percorso, codice, dispositivo }: {
  percorso: string; codice: string; dispositivo: Dispositivo;
}) {
  const [areaRef, area] = useMisura<HTMLDivElement>();
  const MISURE: Record<Dispositivo, { w: number; h: number } | null> = {
    desktop: null,
    tablet: { w: 834, h: 1112 },
    mobile: { w: 390, h: 844 },
  };
  const dev = MISURE[dispositivo];
  const indirizzo = `${percorso}?regia=${encodeURIComponent(codice)}`;

  if (!dev) {
    return (
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-white/15 bg-white">
        <iframe key={indirizzo} src={indirizzo} title="Quello che stai mostrando" className="h-full w-full border-0" />
      </div>
    );
  }

  const larghezza = area.larghezza || 1200;
  const altezza = area.altezza || 620;
  const scala = Math.max(0.2, Math.min((altezza - 8) / dev.h, (larghezza - 8) / dev.w));
  return (
    <div ref={areaRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
      <div
        className="overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl"
        style={{ width: Math.round(dev.w * scala), height: Math.round(dev.h * scala) }}
      >
        <iframe
          key={`${dispositivo}-${indirizzo}`}
          src={indirizzo}
          title="Quello che stai mostrando"
          style={{
            width: dev.w, height: dev.h, border: 0, display: "block",
            transform: `scale(${scala})`, transformOrigin: "top left",
          }}
        />
      </div>
    </div>
  );
}

function TreSchermate({ percorso, codice, comanda, setComanda }: {
  percorso: string; codice: string;
  comanda: Dispositivo; setComanda: (d: Dispositivo) => void;
}) {
  const [areaRef, area] = useMisura<HTMLDivElement>();
  /** ── SU QUALE SCHERMATA STO LAVORANDO ───────────────────────────────────
   *  ⚠️ La scelta vive nella console e non qui: si fa dalla BARRA, accanto a
   *   «3 schermate», perché lì la si vede. Nascosta sotto le cornici era
   *   un'etichetta piccola che sembrava un'informazione, non un comando — e
   *   infatti non l'ha trovata nessuno.
   *  ⚠️ Una sola comanda, e la scegli tu. Chi conduce un webinar sa già dove
   *   guarda la sua gente — quasi sempre il telefono — e vuole lavorare LÌ,
   *   non su un monitor che nessuno sta usando. La schermata scelta va in
   *   cima e grande; le altre due restano sotto e la seguono, come la sala.
   *  ⚠️ La strada opposta — ogni cornice comanda la sua classe di schermi —
   *   è stata provata e scartata: obbligava a guidarne tre insieme, e
   *   dimenticarne una voleva dire lasciare fermo mezzo pubblico. */
  const SCHERMI: { nome: string; dev: Dispositivo; w: number; h: number }[] = [
    { nome: "Computer", dev: "desktop", w: 1280, h: 800 },
    { nome: "Tablet", dev: "tablet", w: 834, h: 1112 },
    { nome: "Telefono", dev: "mobile", w: 390, h: 844 },
  ];
  const capo = SCHERMI.find((s) => s.dev === comanda) || SCHERMI[0];
  const altri = SCHERMI.filter((s) => s.dev !== comanda);

  //  ⚠️ Il ripiego al primo disegno: senza, la prima passata calcolerebbe una
  //   scala zero e le cornici nascerebbero grandi come un francobollo.
  const larghezza = area.larghezza || 1200;
  const altezza = area.altezza || 620;
  //  Due terzi alla schermata su cui si lavora, un terzo alle altre due.
  const scalaCapo = Math.max(0.1, Math.min((altezza * 0.64 - 26) / capo.h, (larghezza - 24) / capo.w));
  const larghiAltri = altri.reduce((s, d) => s + d.w, 0) + 40;
  const altiAltri = Math.max(...altri.map((d) => d.h));
  const scalaAltri = Math.max(0.06, Math.min((altezza * 0.36 - 30) / altiAltri, (larghezza - 24) / larghiAltri));

  const cornice = (d: { nome: string; dev: Dispositivo; w: number; h: number }, scala: number) => {
    const guida = d.dev === comanda;
    return (
      <div key={d.nome} style={{ flex: "0 0 auto" }}>
        <button
          onClick={() => setComanda(d.dev)}
          title={guida ? "Stai lavorando su questa" : `Passa a lavorare sulla schermata ${d.nome.toLowerCase()}`}
          className={`mb-1 flex w-full items-center justify-center gap-1.5 rounded text-[9px] font-semibold uppercase tracking-[0.14em] transition ${
            guida ? "text-white" : "text-white/35 hover:text-white/70"
          }`}
        >
          {d.nome}
          {guida
            ? <span className="rounded bg-brand/40 px-1 py-px text-[8px] text-white">comandi qui</span>
            : <span className="rounded border border-white/15 px-1 py-px text-[8px]">passa</span>}
        </button>
        <div
          className={`overflow-hidden rounded-xl border bg-white ${guida ? "border-brand/70" : "border-white/15"}`}
          style={{ width: Math.round(d.w * scala), height: Math.round(d.h * scala) }}
        >
          {/*  ⚠️ La chiave contiene chi comanda: cambiando schermata le cornici
              si rimontano con l'indirizzo giusto — quella che guida PUBBLICA
              (`?regia=`), le altre GUARDANO (`?webinar=`). Due cornici che
              pubblicano insieme si sovrascriverebbero, e in sala arriverebbe
              l'ultima che ha parlato. */}
          <iframe
            key={`${d.dev}-${percorso}-${comanda}`}
            src={`${percorso}?${guida ? "regia" : "webinar"}=${encodeURIComponent(codice)}`}
            title={`Come si vede su ${d.nome}`}
            style={{
              width: d.w, height: d.h, border: 0, display: "block",
              transform: `scale(${scala})`, transformOrigin: "top left",
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div ref={areaRef} className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-auto">
      {cornice(capo, scalaCapo)}
      <div className="flex items-end justify-center gap-4">
        {altri.map((d) => cornice(d, scalaAltri))}
      </div>
    </div>
  );
}

export function PopupTrasmissione({
  aperto,
  chiudi,
  suConsulenza,
}: {
  aperto: boolean;
  chiudi: () => void;
  /** la strada di sempre, invariata: è esattamente quello che faceva il
   *  pulsante prima che esistesse questa scelta */
  suConsulenza: () => void;
}) {
  const [sale, setSale] = useState<Sala[] | null>(null);
  const [scelta, setScelta] = useState<string>("");

  useEffect(() => {
    if (!aperto) return;
    void (async () => {
      try {
        const r = await fetch("/api/crm/webinar?azione=elenco");
        const j = await r.json();
        setSale(Array.isArray(j?.stanze) ? j.stanze : []);
      } catch {
        setSale([]);
      }
    })();
  }, [aperto]);

  if (!aperto) return null;

  const avviaWebinar = (s: Sala) => {
    chiudi();
    //  ⚠️ SI APRE LA REGIA, non una finestrella qui sopra. Dentro Meetly ogni
    //   cambio di scheda smontava la console e le faceva perdere lo stato — il
    //   pannello che tornava a «Solo te» dopo aver premuto «Slide». La regia è
    //   una schermata sua, dove non si naviga e quindi non si smonta niente.
    //   In una scheda NUOVA: Meetly resta dov'era, e le consulenze pure.
    window.open(`/regia/${encodeURIComponent(s.codice)}`, "_blank", "noopener");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={chiudi}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0b1426] text-white shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <Radio className="h-4 w-4 text-brand" />
          <p className="flex-1 text-sm font-semibold">Che cosa stai per trasmettere?</p>
          <button onClick={chiudi} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10" aria-label="Chiudi">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          {/* ── LA CONSULENZA, COME SEMPRE ──────────────────────────────── */}
          <button
            onClick={() => { chiudi(); suConsulenza(); }}
            className="w-full rounded-xl border border-white/10 p-4 text-left transition hover:border-brand hover:bg-brand/5"
          >
            <p className="flex items-center gap-2 font-semibold"><PhoneCall className="h-4 w-4" /> Consulenza</p>
            <p className="mt-1 text-sm text-white/55">
              Uno a uno col cliente, sul link che gli hai già mandato. Il cliente ti segue: cambi
              pagina tu e cambia anche a lui.
            </p>
          </button>

          {/* ── LE SALE ─────────────────────────────────────────────────── */}
          <div className="rounded-xl border border-white/10 p-4">
            <p className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> Webinar</p>
            <p className="mt-1 text-sm text-white/55">
              Una sala per molte persone. Trasmetti lo schermo, quindi tutto quello che mostri qui —
              preventivo, slide, media, siti — arriva com&apos;è.
            </p>

            {sale === null && (
              <p className="mt-3 flex items-center gap-2 text-sm text-white/40">
                <Loader2 className="h-4 w-4 animate-spin" /> Cerco le sale…
              </p>
            )}

            {sale?.length === 0 && (
              <p className="mt-3 text-sm text-white/45">
                Non hai ancora nessuna sala. Si creano dal gestionale, in <b>Webinar</b>: lì dai il
                nome all&apos;evento e ottieni il link da mandare agli iscritti.
              </p>
            )}

            {!!sale?.length && (
              <div className="mt-3 space-y-2">
                {sale.map((s) => (
                  <div
                    key={s.codice}
                    className={`flex flex-wrap items-center gap-2 rounded-lg border p-2.5 transition ${scelta === s.codice ? "border-brand bg-brand/10" : "border-white/10 hover:bg-white/[0.04]"}`}
                  >
                    <button onClick={() => setScelta(s.codice)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-medium">{s.titolo}</span>
                      <span className="block truncate text-[11px] text-white/40">{s.link}</span>
                    </button>
                    <button
                      onClick={() => { void navigator.clipboard.writeText(s.link).then(() => toast.success("Link copiato")).catch(() => toast.error("Copialo a mano")); }}
                      className="rounded-md border border-white/15 px-2 py-1 text-[11px] hover:bg-white/10"
                    >
                      <Copy className="mr-1 inline h-3 w-3" />Link
                    </button>
                    <button
                      onClick={() => avviaWebinar(s)}
                      className="rounded-md bg-brand px-3 py-1 text-[11px] font-semibold text-white hover:brightness-110"
                    >
                      Conduci
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  LA CONSOLE DELLA SALA
// ══════════════════════════════════════════════════════════════════════════

interface Regia {
  presenti: number;
  passate: number;
  messaggi: MessaggioChat[];
  palco: InPalco[];
  schermi: Schermi | null;
  elenco: { spettatore: string; nome: string }[];
}

/** ⚠️ SEMITRASPARENTE E SEMPRE A GALLA, come chiesto: mentre conduci devi
 *  poter leggere la chat SENZA perdere di vista quello che stai mostrando.
 *  Il fondo è appena velato e sfocato — abbastanza da rendere leggibile il
 *  testo sopra qualunque cosa ci sia dietro, poco da nascondere la pagina.
 *  Un pannello opaco costringerebbe ad aprirlo e chiuderlo di continuo, ed è
 *  nell'istante in cui è chiuso che passa la domanda che valeva la vendita. */
export function ConsoleSala({
  nomePresentatore = "Hair Genius Labs",
  naviga,
  pagina,
}: {
  nomePresentatore?: string;
  /** ── ⚠️ LA REGIA COME SCHERMATA SUA ─────────────────────────────────────
   *  Acceso, questa non è più una finestrella appoggiata sopra Meetly: è la
   *  pagina. Lo studio occupa tutto lo schermo SEMPRE — non solo in salotto —
   *  e i contenuti si mostrano dentro una cornice, qui in mezzo.
   *  È la cura di una malattia, non un vezzo: dentro Meetly ogni cambio di
   *  scheda smonta e rimonta questa console, e ogni cosa che tiene in mano se
   *  ne va con lei. Da qui non si naviga più: si cambia una cornice. */
  pagina?: boolean;
  /** ⚠️ La navigazione arriva DA FUORI e non da un hook del router: questa
   *  console vive dentro la barra del presentatore, e un hook che alza senza
   *  contesto non sbianca il webinar — sbianca l'interfaccia delle consulenze.
   *  Chi la monta il router ce l'ha già. */
  naviga?: (percorso: string) => void;
}) {
  const modo = useModo();
  const [regia, setRegia] = useState<Regia | null>(null);
  const [bozza, setBozza] = useState("");
  const [collegando, setCollegando] = useState(false);
  const [cameraAccesa, setCameraAccesa] = useState(true);
  /** Il pannello che dice PERCHÉ una camera non si vede. Chiuso di suo: si apre
   *  quando serve, e quando serve lo si apre subito senza cercarlo altrove. */
  const [mostraDiagnostica, setMostraDiagnostica] = useState(false);
  /** Il pannello che mostra la sala alle tre misure. Vedi `SpecchioSala`. */
  const [specchioAperto, setSpecchioAperto] = useState(false);

  /** ── ⚠️ QUESTA SCHEDA STA GIRANDO L'ULTIMA VERSIONE? ───────────────────
   *  Il perché sta in `webinar/versione`, ed è il problema che ha fatto
   *  perdere più tempo di tutti: la regia è l'unica scheda che non si ricarica
   *  mai — ricaricandola si esce dalla diretta — quindi una correzione veniva
   *  provata sulla versione vecchia, sembrava non funzionare, e se ne andava a
   *  cercare la causa nel programma.
   *  ⚠️ Ogni due minuti, non ogni giro: una pubblicazione non capita due volte
   *   al minuto, e questa richiesta scarica una pagina intera. */
  const versioneVecchiaQui = useVersioneVecchia();
  const [impostazioniAperte, setImpostazioniAperte] = useState(false);
  /** ⚠️ SERVE UN RIFERIMENTO, non lo stato: il battito vive dentro una funzione
   *  creata una volta sola quando si va in onda, e da lì lo stato di React
   *  resterebbe per sempre quello del primo istante — cioè «accesa», anche a
   *  camera spenta da mezz'ora. */
  const cameraAccesaOra = useRef(true);
  useEffect(() => { cameraAccesaOra.current = cameraAccesa; }, [cameraAccesa]);
  const [micAcceso, setMicAcceso] = useState(true);
  //  ⚠️ NON `useState`: ogni pagina del presentatore disegna la propria barra,
  //   quindi passando da «Media» a «Slide» questa console si smonta e si
  //   rimonta. Con lo stato dentro React, premere «Slide» portava davvero la
  //   sala sulle slide ma il pannello tornava a dire «Solo te», perché
  //   ripartiva dal valore iniziale. Ora vivono nel negozietto, fuori da React.
  const vista = modo.vista;
  const setVista = (v: VistaWebinar) => impostaModo({ vista: v });
  const regiaPalco = modo.regiaPalco;
  const setRegiaPalco = (r: RegiaPalco) => impostaModo({ regiaPalco: r });
  //  Chi si sta guardando adesso nel pannello persona: nome e identificativo,
  //  perché di qualcuno che non è ancora salito il palco non sa niente.
  const [persona, setPersona] = useState<{ spettatore: string; nome: string } | null>(null);
  const [elencoAperto, setElencoAperto] = useState(false);
  const gobbo = modo.gobbo;
  const setGobbo = (v: boolean | ((p: boolean) => boolean)) =>
    impostaModo({ gobbo: typeof v === "function" ? v(modo.gobbo) : v });
  //  ⚠️ «STO SCEGLIENDO COSA MOSTRARE», che è diverso da «mostro contenuti».
  //   Premendo «Contenuti» dentro il salotto, la sala vedeva di colpo la
  //   pagina su cui eri capitato — la libreria dei media, il preventivo di un
  //   altro cliente, quello che c'era. Adesso il salotto resta in onda, si
  //   scopre la barra in basso, e la sala cambia SOLO quando hai scelto
  //   davvero: slide, preventivo, media o link.
  const [scegliendo, setScegliendo] = useState(false);
  //  Quale contenuto sta nella cornice della regia. In pagina non si naviga:
  //  si cambia questo.
  const [percorsoContenuti, setPercorsoContenuti] = useState("/slide");
  /** ── LE TRE SCHERMATE, IN DIRETTA ───────────────────────────────────────
   *  Chi conduce vede il contenuto su un monitor largo e la sala lo guarda
   *  quasi tutta dal telefono: la riga che qui sta su una riga, lì ne prende
   *  tre, e il tasto che qui è a metà schermo lì finisce sotto la piega. Con
   *  questa spunta le tre forme stanno affiancate e vive. */
  const [treSchermate, setTreSchermate] = useState(false);
  /** Quale delle tre schermate stai comandando. Vive qui perché il comando per
   *  cambiarla sta nella barra, sopra la scena. */
  const [comandaSchermo, setComandaSchermo] = useState<Dispositivo>("desktop");
  //  Gli altri che conducono con te, letti dallo stato pubblico della sala: è
  //  l'unico posto in cui sono elencati tutti, compreso chi è entrato dopo.
  const [altriRelatori, setAltriRelatori] = useState<
    { id: string; nome: string; sessionId: string; audio: string; video: string; parla: boolean }[]
  >([]);
  const [ioParlo, setIoParlo] = useState(false);
  const logoStudio = useLogoStudio();
  const flussiRelatori = useRef<Map<string, MediaStream>>(new Map());
  const [registro, setRegistro] = useState(false);
  const [durata, setDurata] = useState(0);
  const registrazione = useRef<Registrazione | null>(null);
  //  ⚠️ UN FLUSSO CHE ESISTE SEMPRE, non un elemento da riempire al momento.
  //   Prima l'audio degli ospiti veniva infilato nell'elemento nell'istante in
  //   cui arrivava: se in quel momento l'elemento non era ancora nato — e a
  //   volte non lo è — quella voce si perdeva per sempre, senza un errore.
  //   Adesso le tracce entrano in un flusso che c'è dal primo istante, e
  //   l'elemento ci si aggancia quando nasce.
  const suonoOspiti = useRef<MediaStream>(new MediaStream());
  const smettiVoce = useRef<(() => void) | null>(null);
  const flussi = useRef<Map<string, MediaStream>>(new Map());
  const nomi = useRef<Map<string, string>>(new Map());
  const agganciate = useRef<Set<string>>(new Set());

  const codice = modo.sala?.codice ?? "";
  //  La pagina su cui sei ADESSO.
  //  ⚠️ NON `useRouterState`. Ci ero passato, e quell'hook ALZA se non trova il
  //   contesto del router: questa console vive dentro la barra del
  //   presentatore, e un'eccezione lì non sbianca il webinar — sbianca
  //   l'interfaccia della consulenza, cioè la cosa che fa i soldi. Per una
  //   riga di comodità non vale la pena legare quel rischio a un componente
  //   nuovo.
  //  Si guarda l'indirizzo e basta: cambiando scheda dentro l'applicazione
  //  cambia senza ricaricare, quindi non c'è un evento da ascoltare — ma un
  //  confronto di stringhe due volte al secondo non lo sente nessuno.
  const percorsoOra = usePercorso();
  const palcoQuanti = regia?.palco.filter((p) => p.stato !== "attesa").length ?? 0;
  const largo = useLarghezza();

  const giro = useCallback(async () => {
    if (!codice) return;
    try {
      const j = await chiedi({ azione: "sala", codice });
      setRegia({
        presenti: j.presenti ?? 0, passate: j.passate ?? 0,
        messaggi: j.messaggi ?? [], palco: j.palco ?? [], schermi: j.schermi ?? null,
        elenco: Array.isArray(j.elenco) ? j.elenco : [],
      });
      (j.palco ?? []).forEach((p: InPalco) => nomi.current.set(p.spettatore, p.nome));
    } catch { /* si riprova */ }
  }, [codice]);

  useEffect(() => {
    if (!codice) return;
    void giro();
    const t = setInterval(() => void giro(), 2500);
    return () => clearInterval(t);
  }, [codice, giro]);

  //  ⚠️ Chi altro sta conducendo si legge dallo stato PUBBLICO della sala, non
  //   da quello di regia: è lì che i relatori si registrano quando vanno in
  //   onda, ed è l'unico elenco che comprende anche chi è entrato dopo di te.
  useEffect(() => {
    if (!codice) return;
    let vivo = true;
    const guarda = async () => {
      const st = await statoDiretta(codice);
      if (vivo) setAltriRelatori(st.relatori ?? []);
    };
    void guarda();
    const t = setInterval(() => void guarda(), 3000);
    return () => { vivo = false; clearInterval(t); };
  }, [codice]);

  //  Aggancia chi sale, senza rifare la connessione.
  useEffect(() => {
    const o = modo.onda;
    if (!o || !regia) return;
    void (async () => {
      const { aggiungiTracce } = await import("./sfu");
      const nuove: { sessionId: string; trackName: string }[] = [];
      //  Gli altri relatori: senza questo, in due, ciascuno non sente l'altro
      //  — e se ne accorgerebbe solo dalla chat, dopo dieci minuti.
      for (const r of altriRelatori) {
        if (r.sessionId === o.sessionId) continue; // la propria voce è larsen
        for (const t of [r.audio, r.video]) {
          const k = `${r.sessionId}/${t}`;
          if (agganciate.current.has(k)) continue;
          agganciate.current.add(k);
          nuove.push({ sessionId: r.sessionId, trackName: t });
        }
      }
      for (const p of regia.palco) {
        if (!p.sessionId) continue;
        for (const t of [p.tracciaAudio, p.tracciaVideo]) {
          if (!t) continue;
          const k = `${p.sessionId}/${t}`;
          if (agganciate.current.has(k)) continue;
          agganciate.current.add(k);
          nuove.push({ sessionId: p.sessionId, trackName: t });
        }
      }
      if (!nuove.length) return;
      try { await aggiungiTracce(codice, o.sessionId, o.pc, nuove, o.registra); }
      catch { nuove.forEach((n) => agganciate.current.delete(`${n.sessionId}/${n.trackName}`)); }
    })();
  }, [regia, modo.onda, codice, altriRelatori]);

  useEffect(() => {
    if (!registro) return;
    const t = setInterval(() => setDurata(registrazione.current?.secondi() ?? 0), 1000);
    return () => clearInterval(t);
  }, [registro]);

  //  L'anteprima sui tre formati: si apre da sé quando la sala è mista, e solo
  //  mentre stai davvero mostrando dei contenuti.
  const [anteprimaAperta, setAnteprimaAperta] = useApriAnteprima(
    regia?.schermi ?? null,
    !!modo.onda && vista === "contenuti",
  );

  //  ⚠️ IL PERCORSO SI RIMANDA A OGNI CAMBIO SCHEDA. Senza, premuto una volta
  //   «Contenuti», la sala resterebbe ferma sulla pagina di allora mentre tu
  //   giri per slide e preventivo — e non lo scopriresti, perché tu la tua
  //   pagina la vedi cambiare.
  //
  //  ⚠️⚠️ E STA SOPRA L'USCITA ANTICIPATA QUI SOTTO, non sotto. Ce l'avevo
  //   messo sotto, ed è costato una schermata «Qualcosa si è rotto» sulla
  //   POSTAZIONE DEL PRESENTATORE — cioè sull'interfaccia delle consulenze —
  //   nell'istante in cui si sceglieva una sala. React conta gli hook a ogni
  //   disegno e pretende sempre lo stesso numero: con `sala` a null questo
  //   componente ne eseguiva uno in meno, e al primo disegno con la sala
  //   scelta il conto cambiava (errore #310).
  //   Qui dentro NON si aggiunge un hook sotto la riga che segue. Mai.
  //  ⚠️ QUALE percorso: il come e il perché stanno in `webinar/schermo`. In
  //   breve: nella pagina `/regia` l'indirizzo del browser non è il contenuto,
  //   e mandarlo alla sala voleva dire non mandarle mai niente di nuovo.
  const percorsoInOnda = percorsoDaMandare({
    pagina: !!pagina,
    contenuto: percorsoContenuti,
    browser: percorsoOra,
  });
  useEffect(() => {
    if (!modo.onda || vista !== "contenuti" || !codice || !percorsoInOnda) return;
    void chiedi({ azione: "vista", codice, vista: "contenuti", percorso: percorsoInOnda }).catch(() => { /* al giro dopo */ });
  }, [percorsoInOnda, vista, codice, modo.onda]);

  //  ── ⚠️ CHI PUBBLICA LO STATO DELLE SLIDE ──────────────────────────────
  //   Le pagine dei contenuti (slide, media…) non sanno niente del webinar:
  //   pubblicano il proprio stato solo se qualcuno dichiara che c'è una sala
  //   in onda e in modalità contenuti. Dichiararlo è compito di questa
  //   console, che è l'unica a saperlo — e va DISDETTO all'uscita, o le slide
  //   della prossima consulenza finirebbero in una sala che non c'è più.
  useEffect(() => {
    const attiva = !!modo.onda && vista === "contenuti" && !!codice;
    salaDeiContenuti(attiva ? codice : "");
    return () => salaDeiContenuti("");
  }, [modo.onda, vista, codice]);

  //  ⚠️ SI PASSA A CONTENUTI QUANDO CAMBI PAGINA, non quando premi il
  //   pulsante: cambiare pagina È la scelta. Finché resti dove sei, la sala
  //   continua a vedere il salotto — e se cambi idea, «Torna al salotto»
  //   rimette tutto com'era senza che nessuno si sia accorto di niente.
  const percorsoAllInizio = useRef<string>("");
  useEffect(() => {
    if (!scegliendo) { percorsoAllInizio.current = percorsoOra; return; }
    if (percorsoOra !== percorsoAllInizio.current) {
      setScegliendo(false);
      cambiaVista("contenuti");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [percorsoOra, scegliendo]);

  /** ── QUANTO SPAZIO C'È DAVVERO ────────────────────────────────────────
   *  ⚠️ Si misura LA SCENA INTERA e si divide, NON la metà di chi conduce.
   *   Misurare la metà sembra più diretto e invece è un serpente che si morde
   *   la coda: dentro la metà ci metto un riquadro a misura fissa, quel
   *   riquadro tiene larga la metà, la misura successiva legge la larghezza
   *   di prima e non stringe più. Si vedeva: in due, i due riquadri restavano
   *   da 833 l'uno — millesettecento punti su milleduecento di finestra — e la
   *   chat finiva spinta fuori dallo schermo.
   *   La scena invece è `w-full`: la sua larghezza gliela dà chi la contiene,
   *   e quello che c'è dentro non la può gonfiare. Da lì il conto è una
   *   divisione. Il come si misura sta in `webinar/misura`. */
  const [scenaRef, scena] = useMisura<HTMLDivElement>();

  /** ── ⚠️ IL FACCIA A FACCIA SI VEDE ANCHE DA QUI ────────────────────────
   *  Chi conduce deve guardare lo STESSO montaggio della sala: sceglierlo e
   *  poi vederselo diverso vuol dire condurre alla cieca — e in un dibattito è
   *  proprio il montaggio la cosa che si sta governando.
   *  ⚠️ Si controlla che la persona sia ancora sul palco: chi esce mentre è
   *   alla pari lascerebbe metà scena a un quadrato nero. */

  /** ── ⚠️ LA BARRA SI MISURA, NON SI INDOVINA ────────────────────────────
   *  La soglia è sulla larghezza VERA della barra e non su quella dello
   *  schermo: questa console vive in due posti — a tutto schermo nella pagina
   *  `/regia`, e in una finestrella dentro la postazione delle consulenze. Una
   *  regola su `sm:` direbbe «schermo largo, mettili in riga» anche quando la
   *  riga è larga trecento punti perché la finestra è piccola.
   *  ⚠️ Settecento punti è quanto serve ai quattordici comandi per stare su una
   *   riga sola: sotto, andavano a capo — ed è il capo a capo, non la
   *   larghezza in sé, a mangiarsi l'altezza della scena. */
  const [barraRef, barra] = useMisura<HTMLDivElement>();
  const stretta = barra.larghezza > 0 && barra.larghezza < 700;

  /** Quale cassetto è aperto sugli schermi stretti: nessuno, «cosa mando in
   *  onda», o «come si comporta la sala». Uno alla volta. */
  const [cassetto, setCassetto] = useState<"onda" | "attrezzi" | null>(null);
  useEffect(() => {
    //  ⚠️ Girando il telefono la barra torna larga e i tasti tornano in riga:
    //   il cassetto resterebbe aperto sotto, con dentro gli stessi tasti già
    //   visibili sopra. Due copie dello stesso comando a schermo.
    if (!stretta) setCassetto(null);
  }, [stretta]);

  if (!modo.sala) return null;

  // ── ANDARE IN ONDA ──────────────────────────────────────────────────
  //  ⚠️ UNA SORGENTE SOLA: la camera. La condivisione schermo è stata tolta
  //   di proposito — vedi la nota sul blocco «Sullo schermo di chi ti
  //   guarda»: le pagine arrivano come pagine, non come fotografia della tua
  //   finestra, e sono leggibili anche su un telefono.
  /** ── ⚠️ SI ACCENDE SEMPRE LA CAMERA, E BASTA ────────────────────────────
   *  Qui c'era anche la condivisione dello schermo, ed era un ripiego di
   *  quando i contenuti non sapevano viaggiare da soli: per mostrare una slide
   *  bisognava riprendere il proprio monitor.
   *  Adesso le slide, il preventivo e i media arrivano alla sala COME DATO —
   *  nitidi, alla risoluzione di chi guarda, e senza mandare in onda per
   *  sbaglio le notifiche o la barra dei preferiti. Chiedere di condividere lo
   *  schermo era diventato un passaggio in più che non serviva a niente.
   *  Quello che cambia non è più la sorgente: è COSA VEDONO — i contenuti, la
   *  tua faccia, o il salotto. La camera parte comunque, perché in tutti e tre
   *  i casi la tua voce serve.
   */
  const vai = async (mostra: VistaWebinar = "camera") => {
    setCollegando(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      /** ── ⚠️ LA SIMULCAST SI LEGGE, NON SI DECIDE QUI ────────────────────
       *  C'era scritto `true` fisso, e nelle impostazioni c'è un interruttore
       *  che si salva, che il server restituisce, e che non cambiava niente:
       *  spegnerlo era un gesto senza effetto.
       *  ⚠️ E NON È UN DETTAGLIO DI PRESTAZIONI. La simulcast fa partire tre
       *   qualità dallo stesso transceiver, e quando quel meccanismo non va
       *   d'accordo col browser o con l'SFU il sintomo non è «video peggiore»:
       *   è AUDIO CHE FUNZIONA E VIDEO NERO. Cioè esattamente il guasto che si
       *   sta inseguendo — e finché l'interruttore non faceva niente, non c'era
       *   modo di provare a escluderla.
       *  Se la risposta non arriva si resta accesi: è il comportamento di
       *  sempre, e un webinar che non parte è peggio di uno senza simulcast. */
      //  ⚠️ `config` è una GET, non una POST come tutte le altre azioni di
      //   questo file: chiederla con `chiedi()` tornerebbe sempre un errore, e
      //   l'interruttore resterebbe finto per la seconda volta.
      let conSimulcast = true;
      try {
        const r = await fetch("/api/crm/webinar?azione=config");
        const c = (await r.json()) as { simulcast?: boolean };
        if (r.ok && typeof c?.simulcast === "boolean") conSimulcast = c.simulcast;
      } catch { /* si resta come prima */ }

      const o = await vaiInOnda(codice, stream, {
        simulcast: conSimulcast,
        intestazioni: {},
        instrada: (nome, traccia) => {
          //  ⚠️ Le tracce dei RELATORI si chiamano «audio-<id>»/«video-<id>»,
          //   quelle del palco «a-<id>»/«v-<id>». Due forme diverse perché la
          //   prima esisteva già quando il relatore era uno solo, e cambiarla
          //   avrebbe fatto sparire il video alle sale già aperte.
          const rel = /^(audio|video)-(.+)$/.exec(nome);
          if (rel) {
            const chi = rel[2];
            let f = flussiRelatori.current.get(chi);
            if (!f) { f = new MediaStream(); flussiRelatori.current.set(chi, f); }
            f.addTrack(traccia);
            if (traccia.kind === "audio") suonoOspiti.current.addTrack(traccia);
            return;
          }
          const m = /^([av])-(.+)$/.exec(nome);
          if (!m) return;
          const chi = m[2];
          let f = flussi.current.get(chi);
          if (!f) { f = new MediaStream(); flussi.current.set(chi, f); }
          f.addTrack(traccia);
          if (traccia.kind === "audio") suonoOspiti.current.addTrack(traccia);
        },
      });
      //  ⚠️ La propria voce si misura e si comunica: è quello che fa allargare
      //   il proprio riquadro sullo schermo di chi guarda. Senza, in due, la
      //   fascia resterebbe divisa a metà anche quando parla uno solo.
      smettiVoce.current?.();
      smettiVoce.current = sorvegliaVoce(stream, (sta) => {
        setIoParlo(sta);
        void chiedi({ azione: "battito", codice, parla: sta, camera: cameraAccesaOra.current }).catch(() => { /* al battito dopo */ });
      });
      impostaModo({ onda: o, media: stream, sorgente: "camera" });
      //  Si va in onda già su quello che si è scelto, senza un secondo clic:
      //  chi preme «Contenuti» sta dicendo «comincia mostrando le slide», non
      //  «comincia e poi te lo dico».
      cambiaVista(mostra, mostra === "contenuti" ? percorsoContenuti : undefined);
      setCameraAccesa(true);
      setMicAcceso(true);
      setVista("camera");
      toast.success("Sei in onda");
    } catch (e) {
      toast.error(String((e as Error).message || e));
    } finally {
      setCollegando(false);
    }
  };

  const fermaTutto = async () => {
    if (registrazione.current) await fermaRegistrazione();
    smettiVoce.current?.();
    smettiVoce.current = null;
    await modo.onda?.chiudi();
    modo.media?.getTracks().forEach((t) => t.stop());
    flussi.current.clear();
    agganciate.current.clear();
    impostaModo({ onda: null, media: null });
    toast.success("Diretta terminata");
  };

  const fermaRegistrazione = async () => {
    const r = registrazione.current;
    if (!r) return;
    registrazione.current = null;
    setRegistro(false);
    void chiedi({ azione: "registrando", codice, acceso: false }).catch(() => { /* */ });
    const file = await r.ferma();
    if (!file) return;
    const esito = await archivia(file, { codice, titolo: modo.sala?.titolo || "Webinar", secondi: r.secondi() }, {});
    if (esito.ok) toast.success("Registrazione salvata"); else toast.error(esito.motivo || "Non salvata");
  };

  const registra = () => {
    //  ⚠️ LA REGISTRAZIONE PRENDE IL FLUSSO DI ADESSO. Spegnendo e
    //   riaccendendo la camera mentre si registra, il flusso cambia identità
    //   (vedi `nuovoFlusso`) e il registratore continua con quello vecchio:
    //   nel file la camera resta spenta anche dopo averla riaccesa. È un caso
    //   limite noto — si spegne la camera durante una registrazione di rado —
    //   e sta scritto qui perché il giorno che capita non sia un mistero.
    if (registrazione.current || !modo.media) return;
    registrazione.current = avviaRegistrazione(
      () => ({
        principale: modo.media,
        riquadri: Array.from(flussi.current.entries()).map(([id, stream]) => ({ nome: nomi.current.get(id) || "Ospite", stream })),
      }),
      { microfono: modo.media },
    );
    setRegistro(true);
    void chiedi({ azione: "registrando", codice, acceso: true }).catch(() => { /* */ });
  };

  /** Accende e spegne una traccia in uscita.
   *  ⚠️ `enabled = false` e non `stop()`: fermare la traccia libera il
   *   dispositivo e la spia si spegne, ma per riaccenderla il browser
   *   richiederebbe il permesso — in mezzo a una diretta, davanti a
   *   duecento persone. Così invece smette solo di mandare, e torna in un
   *   istante. */
  /** ── ⚠️ SPEGNERE LA CAMERA LA SPEGNE DAVVERO ─────────────────────────────
   *  Il microfono si spegne con `enabled = false` e va benissimo: non c'è una
   *  spia, e riaccenderlo dev'essere istantaneo.
   *  La CAMERA no. Con `enabled = false` smette di mandare fotogrammi ma il
   *  dispositivo resta aperto: la lucina accanto all'obiettivo resta accesa, e
   *  chi ha appena detto «spengo la camera» se la vede addosso — segnalato dal
   *  committente, «rimane accesa». Per spegnerla si FERMA la traccia, e il suo
   *  posto nella connessione si riempie con `null`, altrimenti la sala resta
   *  con l'ultimo fotogramma congelato.
   *  ⚠️ RIACCENDERE CHIEDE UNA CAMERA NUOVA, e va bene: il permesso è già stato
   *   dato una volta e il browser non lo richiede — quello che si ricrea è la
   *   traccia, non il consenso.
   *  ⚠️ E se il browser non sostiene `replaceTrack`, si ripiega su `enabled`
   *   invece di lasciare il pulsante che dice una cosa e la camera un'altra. */
  /** Un flusso NUOVO con l'audio di prima e (se c'è) la camera passata.
   *  ⚠️ Nuovo di identità, non solo di contenuto: è l'identità che fa
   *   riagganciare i `<video>` (vedi `attaccaFlusso`). */
  const nuovoFlusso = (vecchio: MediaStream | null | undefined, video: MediaStreamTrack | null) => {
    const s = new MediaStream();
    vecchio?.getAudioTracks().forEach((a) => s.addTrack(a));
    if (video) s.addTrack(video);
    return s;
  };

  const spegniCamera = async () => {
    const vecchia = modo.media?.getVideoTracks()[0];
    if (!vecchia) return;
    const fatto = await modo.onda?.sostituisciVideo(null);
    if (fatto === false) { vecchia.enabled = false; setCameraAccesa(false); return; }
    vecchia.stop();
    //  ⚠️ UN FLUSSO NUOVO, non lo stesso senza una traccia. Un `MediaStream` a
    //   cui si toglie una traccia resta LO STESSO OGGETTO, e chi lo guarda —
    //   `attaccaFlusso` confronta `el.srcObject !== flusso` — non vede nessun
    //   cambiamento e non riaggancia niente. Il riquadro resterebbe con
    //   l'ultimo fotogramma congelato invece di mostrare la camera spenta.
    impostaModo({ media: nuovoFlusso(modo.media, null) });
    setCameraAccesa(false);
  };

  const riaccendiCamera = async () => {
    try {
      const nuovo = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
      });
      const traccia = nuovo.getVideoTracks()[0];
      if (!traccia) return;
      //  ⚠️ «motion» come alla partenza: dice al codificatore che è una persona
      //   che si muove e non un foglio fermo. Senza, la camera riaccesa
      //   spenderebbe i bit in modo diverso da com'era prima — e si vede.
      (traccia as unknown as { contentHint: string }).contentHint = "motion";
      const fatto = await modo.onda?.sostituisciVideo(traccia);
      if (fatto === false) { traccia.stop(); return; }
      modo.media?.getVideoTracks().forEach((v) => v.stop());
      //  ⚠️ QUI STAVA IL DIFETTO: aggiungevo la traccia allo STESSO flusso.
      //   L'oggetto non cambia, quindi nessun <video> si riaggancia e la
      //   camera resta nera anche se la traccia c'è e sta funzionando. È lo
      //   stesso motivo per cui `attaccaFlusso` esiste — e ci sono cascato
      //   dall'altra parte.
      impostaModo({ media: nuovoFlusso(modo.media, traccia) });
      setCameraAccesa(true);
    } catch {
      toast.error("La camera non si riapre: controlla che non la stia usando un'altra scheda");
    }
  };

  const cambiaTraccia = (genere: "video" | "audio") => {
    if (genere === "video") {
      void (cameraAccesa ? spegniCamera() : riaccendiCamera()).then(() => {
        void chiedi({ azione: "battito", codice, camera: !cameraAccesa }).catch(() => { /* al battito dopo */ });
      });
      return;
    }
    const t = modo.media?.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setMicAcceso(t.enabled);
  };

  /** Cambia cosa vede la sala. Il percorso viaggia INSIEME alla modalità: in
   *  «contenuti» la sala deve seguirti anche quando cambi scheda, senza che tu
   *  debba ripremere il pulsante. */
  const cambiaVista = (v: VistaWebinar, percorso?: string) => {
    setVista(v);
    //  ⚠️ Il percorso si può passare a mano, e serve: premendo «Slide» la
    //   navigazione è appena partita e `window.location` dice ancora la pagina
    //   di prima — la sala sarebbe rimasta indietro di uno.
    void chiedi({ azione: "vista", codice, vista: v, percorso: percorso ?? percorsoInOnda }).catch(() => {
      toast.error("Non è cambiato quello che vedono: riprova");
    });
  };

  const comandiPersona: ComandiPersona = {
    faiSalire: (spettatore, nome, m) => {
      void chiedi({ azione: "fai-salire", codice, spettatore, nome, modo: m })
        .then(() => {
          //  ⚠️ DARE LA PAROLA PORTA IN SALOTTO, da solo. Far salire qualcuno
          //   e lasciare la sala su «Solo te» vuol dire che quella persona
          //   parla e nessuno la vede: il gesto era «fallo entrare», non «fallo
          //   entrare e poi ricordati di cambiare vista». Chi conduce sta
          //   parlando, non ha una mano libera per un secondo comando.
          //   Vale per tutti e due i modi: anche chi sale in sola voce deve
          //   comparire nel salotto, altrimenti la sala sente un fantasma.
          if (vista !== "salotto") cambiaVista("salotto");
        })
        .then(giro)
        .catch((e) => toast.error(String((e as Error).message || e)));
    },
    faiScendere: (spettatore) => { void chiedi({ azione: "fai-scendere", codice, spettatore }).then(giro); },
    microfono: (spettatore, acceso) => { void chiedi({ azione: "microfono", codice, spettatore, acceso }).then(giro); },
    camera: (spettatore, accesa) => { void chiedi({ azione: "camera-ospite", codice, spettatore, acceso: accesa }).then(giro); },
    bandisci: (spettatore, nome) => {
      void chiedi({ azione: "bandisci", codice, spettatore }).then(giro);
      toast.success(`${nome} non potrà più entrare`);
    },
    inOnda: (spettatore, acceso) => {
      /** ── ⚠️ SI SCRIVE UNA LISTA ESPLICITA ────────────────────────────
       *  Finché `mostrati` è ASSENTE vuol dire «si vedono tutti», ed è il caso
       *  normale. Per togliere UNO bisogna per forza passare a un elenco: si
       *  parte da chi c'è adesso e si toglie lui. Da quel momento la lista
       *  esiste, e chi sale dopo va aggiunto — se ne occupa «Tutti», che è il
       *  modo di tornare al caso normale.
       *  ⚠️ Chi conduce non si può togliere: è l'unico riquadro che non deve
       *   poter sparire, e una sala senza nessuno in onda è una sala nera. */
      const tutti = ["io", ...suPalco.map((p) => p.spettatore)];
      const base = Array.isArray(regiaPalco.mostrati) ? regiaPalco.mostrati : tutti;
      const nuovi = acceso
        ? Array.from(new Set([...base, spettatore]))
        : base.filter((x) => x !== spettatore);
      const nuova: RegiaPalco = {
        ...regiaPalco,
        mostrati: nuovi,
        //  Togliere dalla diretta chi era grande spegne anche il montaggio a
        //  due: un quadrato su una persona che la sala non vede è nero.
        ...(!acceso && regiaPalco.primoPiano === spettatore ? { primoPiano: "" } : {}),
        ...(!acceso && regiaPalco.facciaAFaccia === spettatore ? { facciaAFaccia: undefined } : {}),
      };
      setRegiaPalco(nuova);
      void chiedi({
        azione: "palcoscenico", codice,
        mostrati: nuova.mostrati, primoPiano: nuova.primoPiano,
        facciaAFaccia: nuova.facciaAFaccia ?? "",
      }).then(giro).catch(() => toast.error("Non è cambiato: riprova"));
      toast.success(acceso ? "Torna in diretta" : "Tolto dalla diretta: resta collegato");
    },
    facciaAFaccia: (spettatore, acceso) => {
      const chi = acceso ? spettatore : "";
      //  ⚠️ Si aggiorna SUBITO qui, prima della risposta del server: chi
      //   conduce ha appena premuto e sta guardando lo schermo. Aspettare il
      //   giro vorrebbe dire un secondo in cui non è successo niente, e in un
      //   secondo si preme di nuovo.
      setRegiaPalco({ ...regiaPalco, facciaAFaccia: chi || undefined });
      void chiedi({ azione: "palcoscenico", codice, facciaAFaccia: chi })
        .then(giro)
        .catch(() => {
          setRegiaPalco({ ...regiaPalco, facciaAFaccia: acceso ? undefined : spettatore });
          toast.error("Il montaggio non è cambiato: riprova");
        });
      toast.success(acceso ? "Siete alla pari: due quadrati uguali" : "Montaggio normale");
    },
  };

  const comandi: ComandiChat = {
    apriPersona: (spettatore, nome) => setPersona({ spettatore, nome }),
    faiSalire: (spettatore, nome, m) => {
      void chiedi({ azione: "fai-salire", codice, spettatore, nome, modo: m })
        .then(() => {
          //  ⚠️ DARE LA PAROLA PORTA IN SALOTTO, da solo. Far salire qualcuno
          //   e lasciare la sala su «Solo te» vuol dire che quella persona
          //   parla e nessuno la vede: il gesto era «fallo entrare», non «fallo
          //   entrare e poi ricordati di cambiare vista». Chi conduce sta
          //   parlando, non ha una mano libera per un secondo comando.
          //   Vale per tutti e due i modi: anche chi sale in sola voce deve
          //   comparire nel salotto, altrimenti la sala sente un fantasma.
          if (vista !== "salotto") cambiaVista("salotto");
        })
        .then(giro)
        .catch((e) => toast.error(String((e as Error).message || e)));
    },
    faiScendere: (spettatore) => { void chiedi({ azione: "fai-scendere", codice, spettatore }).then(giro); },
    microfono: (spettatore, acceso) => { void chiedi({ azione: "microfono", codice, spettatore, acceso }).then(giro); },
    fissa: (id, acceso) => { void chiedi({ azione: "fissa", codice, id, acceso }).then(giro); },
    cancella: (id) => { void chiedi({ azione: "cancella-messaggio", codice, id }).then(giro); },
  };

  const invia = async () => {
    const testo = bozza.trim();
    if (!testo) return;
    setBozza("");
    try { await chiedi({ azione: "scrivi", codice, testo }); void giro(); }
    catch { setBozza(testo); }
  };

  const mani = regia?.palco.filter((p) => p.stato === "attesa").length ?? 0;
  const inOnda = !!modo.onda;

  //  La tua per prima e sempre, le altre solo in salotto: fuori dal salotto la
  //  sala non le vede, e mostrartele qui direbbe una cosa falsa su cosa è in
  //  onda.
  const suPalco = (regia?.palco ?? []).filter((p) => p.stato !== "attesa");
  //  ⚠️ La stessa funzione che usa la sala: se qui si calcolasse un montaggio e
  //   là un altro, il presentatore vedrebbe una cosa e gli spettatori un'altra
  //   — e se ne accorgerebbe solo riguardando la registrazione.
  const inScena = chiVaInOnda(regiaPalco, suPalco.map((p) => p.spettatore));

  /** ── ⚠️ LA CONSOLE NON PUÒ DISEGNARE CHI LA SALA NON VEDE ──────────────
   *  Si filtra su `inScena.elenco` — la stessa regola che usa la sala — e non
   *  sul palco grezzo. Senza questo filtro la console mostrava a chi conduce
   *  due riquadri grandi e una fila di ospiti mentre il pubblico vedeva la
   *  sola camera di chi conduceva: è successo, ed è il modo più veloce di
   *  condurre alla cieca. Una console che mente è peggio di una console che
   *  non mostra niente. */
  const sulPalcoVivi = (regia?.palco ?? []).filter(
    (p) => p.stato !== "attesa" && inScena.elenco.includes(p.spettatore),
  );
  const sfidanteConsole =
    (regiaPalco.facciaAFaccia
      ? sulPalcoVivi.find((p) => p.spettatore === regiaPalco.facciaAFaccia)
      : null)
    //  ⚠️ ANCHE IL PRIMO PIANO PORTA QUI, esattamente come in sala: sono due
    //   modi di dire «voglio vedere bene questa persona», e devono dare lo
    //   stesso montaggio. Se qui restassero due strade diverse, chi conduce
    //   toccherebbe una camera per il primo piano e vedrebbe una cosa mentre
    //   la sala ne vede un'altra — che è il difetto che questa riga esiste per
    //   non avere.
    ?? (inScena.primoPiano && inScena.primoPiano !== "io"
      ? sulPalcoVivi.find((p) => p.spettatore === inScena.primoPiano)
      : null)
    ?? null;
  const duoConsole = duello(scena.larghezza, scena.altezza);

  //  ── I RELATORI: tu più chi conduce con te ────────────────────────────
  const relatori: Relatore[] = inOnda
    ? [
        { id: "io", nome: "Tu", stream: modo.media, mia: true, parla: ioParlo },
        ...altriRelatori
          //  Sé stessi non ci si riguarda due volte: la propria sessione è già
          //  la riga «io» qui sopra.
          .filter((r) => r.sessionId !== modo.onda?.sessionId)
          .map((r) => ({
            id: r.id,
            nome: r.nome,
            stream: flussiRelatori.current.get(r.id) ?? null,
            parla: r.parla,
          })),
      ]
    : [];
  const altriSulPalcoConsole = (regia?.palco ?? []).filter((p) => p.stato !== "attesa");

  /** ── LA STESSA REGOLA DELLA SALA ────────────────────────────────────────
   *  `webinar/palco-tetris`, identico a quello che gira nella sala: se la
   *  console ne calcolasse uno suo, chi conduce vedrebbe una disposizione e il
   *  pubblico un'altra — e se ne accorgerebbe solo riguardando la
   *  registrazione. È la stessa scelta già fatta per `chiVaInOnda`.
   *  ⚠️ Si misura sullo spazio DELLA SCENA e non della finestra: la chat della
   *   console si prende la sua colonna, e contarla vorrebbe dire credere di
   *   avere trecento punti che non ci sono. */
  /** Chi sta grande nell'altra metà, e chi resta nella fila.
   *  ⚠️ «io» non conta: il presentatore ha già la sua metà. Se la regia mette
   *   in primo piano sé stessa, la scena resta a uno solo — che è quello che
   *   vuol dire. */
  const ospiteGrandeConsole =
    inScena.primoPiano && inScena.primoPiano !== "io"
      ? altriSulPalcoConsole.find((p) => p.spettatore === inScena.primoPiano) ?? null
      : null;
  const ospitiPiccoliConsole = altriSulPalcoConsole.filter(
    (p) => p.spettatore !== ospiteGrandeConsole?.spettatore,
  );


  const disposizione = disponiPalco({
    larghezza: largo || 1280,
    altezza: typeof window !== "undefined" ? window.innerHeight - 120 : 700,
    ospiti: altriSulPalcoConsole.length,
    inPrimoPiano: !!inScena.primoPiano && inScena.primoPiano !== "io",
    //  ⚠️ Lo spazio vero, non la finestra: la chat si prende la sua colonna e
    //   la barra dei tasti la sua riga. Con la finestra il conto diceva
    //   «affiancati» anche quando affiancati era la scelta peggiore.
    scena: scena.larghezza ? scena : undefined,
  });

  /** Il riquadro di una metà: la scena divisa per quanti ci stanno, e dentro
   *  il rettangolo 16:9 più grande che ci entra. Le due metà hanno la stessa
   *  misura per costruzione — non due conti che un giorno divergono. */
  const META = disposizione.modo === "duo" ? 2 : 1;
  const SPAZIO = 6; //  il `gap-1.5` fra le due metà, in punti
  const riquadroConduce = riquadroDentro(
    disposizione.orientamento === "fianco"
      ? (scena.larghezza - SPAZIO * (META - 1)) / META
      : scena.larghezza,
    disposizione.orientamento === "fianco"
      ? scena.altezza
      : (scena.altezza - SPAZIO * (META - 1)) / META,
  );

  /** ── I FATTI PER IL PANNELLO «PERCHÉ NON SI VEDE» ──────────────────────
   *  ⚠️ SI LEGGONO DALLE FONTI VERE, non da uno stato riassunto: cosa dice il
   *   server di avergli registrato (`regia.palco`), a cosa ci siamo agganciati
   *   davvero (`agganciate`), e cosa è materialmente arrivato (`flussi`). Un
   *   riassunto tenuto a parte sarebbe una quarta versione della verità, e la
   *   diagnosi direbbe che va tutto bene mentre lo schermo è nero.
   *  Si calcola solo a pannello aperto: scorrere i flussi a ogni ridisegno,
   *  durante una diretta, è lavoro buttato. */
  const fattiPalco: FattiPersona[] = mostraDiagnostica
    ? altriSulPalcoConsole.map((p) => {
        const f = flussi.current.get(p.spettatore) ?? null;
        return {
          nome: p.nome || p.spettatore,
          spettatore: p.spettatore,
          stato: String(p.stato || ""),
          sessionId: p.sessionId || "",
          tracciaAudio: p.tracciaAudio || "",
          tracciaVideo: p.tracciaVideo || "",
          agganciate: [...agganciate.current].filter((k) => k.startsWith(`${p.sessionId}/`)),
          arrivate: f
            ? f.getTracks().map((tr) => ({
                kind: tr.kind, enabled: tr.enabled, muted: tr.muted, readyState: tr.readyState,
              }))
            : [],
          flusso: !!f,
        };
      })
    : [];

  const camere: Camera[] = inOnda
    ? [
        {
          chiave: "io", nome: "Tu", stream: modo.media, mia: true,
          inOnda: inScena.elenco.includes("io"),
          primoPiano: inScena.primoPiano === "io",
        },
        //  ⚠️ In console si vedono TUTTI quelli sul palco, anche chi è fuori
        //   campo (smorzato): devi poter guardare chi sta per parlare PRIMA di
        //   mandarlo in onda. Nella sala, invece, compaiono solo quelli in onda.
        //
        //  ⚠️ E QUESTO ERA SCRITTO SOLO NEL COMMENTO. La riga sotto diceva
        //   `vista === "salotto"`, cioè il contrario: con la vista su «Solo te»
        //   — che è quella da cui si parte SEMPRE — la camera di chi saliva sul
        //   palco non entrava nemmeno nell'elenco, e in console non compariva
        //   niente. L'audio invece passava (viaggia per conto suo), e il
        //   risultato era esattamente «lo spettatore si sente ma non si vede».
        //   La vista decide cosa vede LA SALA, non cosa vedi tu che dirigi:
        //   dovendo scegliere chi mandare in onda, il presentatore le camere le
        //   deve avere davanti prima.
        ...suPalco.map((p) => ({
          chiave: p.spettatore,
          nome: p.nome,
          stream: flussi.current.get(p.spettatore) ?? null,
          parla: p.parla && p.microfono,
          inOnda: inScena.elenco.includes(p.spettatore),
          primoPiano: inScena.primoPiano === p.spettatore,
          microfono: p.microfono,
        })),
      ]
    : [];

  /** Manda o toglie dal primo piano. Toccando chi è già in primo piano si
   *  torna a tutti alla pari: è il gesto d'annullamento più ovvio, e non
   *  richiede un secondo pulsante. */
  /** ── ⚠️ METTERE IN PRIMO PIANO VUOL DIRE ANCHE MANDARE IN ONDA ─────────
   *  Erano due comandi indipendenti che potevano contraddirsi, e si
   *  contraddicevano davvero: con «in onda 1» la lista dei mostrati diventa
   *  `["io"]`, e toccando poi la camera di un ospite il primo piano finiva su
   *  qualcuno che NON era in onda. Da qui in avanti le due parti raccontavano
   *  due cose diverse — la console lo disegnava grande, la sala non lo
   *  disegnava affatto — e chi conduce vedeva un dibattito che il pubblico non
   *  vedeva. Letto sulla sala vera: `mostrati: ["io"]` con
   *  `primoPiano: "a60f3cfd…"`, e in sala nessun ospite.
   *  ⚠️ Non si tocca la lista quando è ASSENTE: assente vuol dire «si vedono
   *   tutti», che è già il caso giusto. Scriverla di nostra iniziativa
   *   trasformerebbe un «tutti» in un elenco fisso, e il prossimo che sale non
   *   comparirebbe più. */
  /** ── ⚠️ UNA SOLA STRADA PER CAMBIARE IL PALCO ──────────────────────────
   *  Prima ogni tasto costruiva il suo `RegiaPalco` e lo mandava per conto
   *  suo, e quello era il motivo per cui due comandi potevano contraddirsi —
   *  «in onda 1» più un primo piano su un altro davano una regia che mostrava
   *  una cosa e una sala che ne mostrava un'altra. Adesso le regole stanno in
   *  `webinar/regia-palco` e QUESTA è l'unica funzione che pubblica: chi
   *  disegna sceglie la regola, non il messaggio.
   *  ⚠️ Si aggiorna a schermo SUBITO, prima della risposta: chi conduce ha
   *   appena premuto e sta guardando. Aspettare il giro vuol dire un secondo in
   *   cui non è successo niente, e in un secondo si preme di nuovo.
   *  ⚠️ `facciaAFaccia` viaggia come stringa vuota quando è spento: il server
   *   distingue «non me ne occupo» (campo assente) da «toglilo» (vuoto), e
   *   senza quella distinzione non ci sarebbe modo di spegnerlo. */
  const comandaPalco = (nuova: RegiaPalco) => {
    setRegiaPalco(nuova);
    void chiedi({
      azione: "palcoscenico",
      codice,
      mostrati: nuova.mostrati ?? null,
      primoPiano: nuova.primoPiano ?? "",
      facciaAFaccia: nuova.facciaAFaccia ?? "",
    })
      .then(giro)
      .catch(() => toast.error("Il palco non è cambiato: riprova"));
  };

  /** Le persone sul palco con i loro due stati. Vedi `webinar/regia-palco`. */
  const righeRegia = elencoRegia(regiaPalco, suPalco);

  /** Sto mandando in onda una slide, un preventivo, un media?
   *  ⚠️ Da qui in giù comanda il contenuto: le camere diventano una fila sola
   *   di miniature, e tutti gli altri montaggi si fanno da parte. Tre montaggi
   *   che si sommano lasciano al contenuto una striscia — o niente. */
  const contenutiInOnda = vista === "contenuti";

  const barraRegia = (
    <div className="flex flex-wrap items-center gap-1.5">
                {righeRegia.map((r) => (
                  <div
                    key={r.chiave}
                    className={`flex items-center gap-1 rounded-lg border transition ${
                      r.grande
                        ? "border-brand bg-brand/20"
                        : r.inOnda
                          ? "border-white/20 bg-white/[0.06]"
                          //  Fuori dalla diretta: spento e sbiadito, si legge
                          //  «c'è ma non si vede» senza doverlo scrivere.
                          : "border-white/10 bg-transparent opacity-45"
                    }`}
                  >
                    {/*  ⚠️ Il NOME è il tasto per l'occhio grande: è il gesto
                          che si fa più spesso in un dibattito, e deve essere
                          il bersaglio più largo. */}
                    <button
                      onClick={() => comandaPalco(conGrande(regiaPalco, suPalco, r.chiave))}
                      title={r.grande ? "Torna al montaggio normale" : `Metti ${r.nome} in grande`}
                      className="max-w-[9rem] truncate py-1.5 pl-2.5 text-[12px] font-medium text-white/85"
                    >
                      {r.nome}
                    </button>
                    {/*  ⚠️ L'occhio c'è per tutti TRANNE che per chi conduce:
                          lui non si può togliere, e un comando spento accanto
                          agli altri accesi si prova comunque una volta. */}
                    {r.sonoIo ? (
                      <span className="pr-2 text-[10px] uppercase tracking-wide text-white/35">tu</span>
                    ) : (
                      <button
                        onClick={() => comandaPalco(conInOnda(regiaPalco, suPalco, r.chiave, !r.inOnda))}
                        title={r.inOnda ? `Togli ${r.nome} dalla diretta` : `Rimetti ${r.nome} in diretta`}
                        className="px-2 py-1.5 text-white/50 transition hover:text-white"
                      >
                        {r.inOnda ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                ))}

                {/*  ⚠️ I DUE GESTI RAPIDI, e nessun numero: «togliamoli tutti
                      per un attimo» e «rimettiamoli» sono le due domande che
                      uno si fa davvero. Nessuno scende: restano collegati e
                      col microfono com'era, semplicemente la sala non li vede.
                      È la differenza fra abbassare una luce e mandare via una
                      persona. */}
                {righeRegia.length > 1 && (
                  <>
                    <span className="mx-1 h-4 w-px bg-white/10" />
                    <button
                      onClick={() => comandaPalco(conSoloIo(regiaPalco))}
                      title="Solo la tua camera: gli altri restano collegati ma la sala non li vede"
                      className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition ${
                        righeRegia.every((r) => r.sonoIo || !r.inOnda)
                          ? "bg-brand text-white"
                          : "border border-white/15 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      Solo io
                    </button>
                    <button
                      onClick={() => comandaPalco(conTutti(regiaPalco))}
                      title="Rimetti in diretta tutti quelli sul palco"
                      className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition ${
                        !regiaPalco.mostrati
                          ? "bg-brand text-white"
                          : "border border-white/15 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      Tutti
                    </button>
                  </>
                )}
    </div>
  );

  /** Toccare una camera la mette grande: la regola è la stessa del nome nella
   *  barra, e passa dallo stesso posto. */
  const versoIlPrimoPiano = (chiave: string) => comandaPalco(conGrande(regiaPalco, suPalco, chiave));

  // ── CHIUSA: una linguetta, che però il numero lo dice lo stesso ──────
  if (!modo.consoleAperta) {
    return (
      <button
        onClick={() => impostaModo({ consoleAperta: true })}
        className="fixed right-3 top-24 z-[90] flex items-center gap-2 rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-xs text-white shadow-xl backdrop-blur-md hover:bg-slate-900/85"
      >
        <MessageSquare className="h-4 w-4" />
        <span className="tabular-nums">{regia?.presenti ?? 0}</span>
        {mani > 0 && <span className="rounded bg-amber-400/25 px-1.5 py-0.5 text-amber-200">{mani} ✋</span>}
        {inOnda && <span className="h-2 w-2 rounded-full bg-rose-400" />}
      </button>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  //  IL SALOTTO A SCHERMO INTERO
  //  ⚠️ VA IN UN PORTALE SU `document.body`, e non è pignoleria: il pannello
  //   qui sotto ha `backdrop-filter`, e un elemento con quella proprietà
  //   diventa il RIFERIMENTO di tutti i `fixed` che contiene. Il palco, scritto
  //   dentro il pannello, veniva ritagliato ai suoi ventuno rem — testo sopra
  //   testo, comandi uno sull'altro. È la stessa trappola per cui i menu della
  //   barra del presentatore stanno fuori dalla barra.
  // ══════════════════════════════════════════════════════════════════════
  //  ⚠️ Mentre stai scegliendo, lo studio si toglie di mezzo ma la VISTA resta
  //   «salotto»: la sala continua a vedere le persone. È tutta la differenza
  //   fra «sto per mostrarvi una cosa» e «guardate la mia libreria media».
  //  Dentro Meetly lo studio va in un portale su `document.body`, o il
  //  `backdrop-filter` del pannello lo ritaglierebbe; come pagina a sé è già
  //  la radice e non serve.
  const avvolgi = (n: React.ReactNode) => (pagina ? n : createPortal(n, document.body));

  /** ── I COMANDI DELLA BARRA, IN DUE GRUPPI ─────────────────────────────
   *  Scritti QUI e non due volte nel disegno: sullo schermo largo vanno in
   *  riga, su quello stretto finiscono in un cassetto, e sono gli stessi
   *  identici tasti che cambiano posto.
   *  · «In onda» — quello che la sala vede: copione, slide, preventivo, media,
   *    link, o soltanto te.
   *  · «Regia» — come si comporta la sala: il link, chi può chiedere la
   *    parola, che numero mostrare, e perché una camera non si vede. */
  const tastiContenuti = (
    <>
                <button
                  onClick={() => setGobbo((v) => !v)}
                  title="Teleprompter — gli stessi copioni delle consulenze"
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] transition ${
                    gobbo ? "border-brand bg-brand text-white" : "border-white/15 hover:bg-white/10"
                  }`}
                >
                  <ScrollText className="mr-1 inline h-3.5 w-3.5" />Copione
                </button>
                {/* ── ⚠️ I CONTENUTI SI SCELGONO DA QUI ────────────────────
                    Lo studio copre tutto lo schermo, barra del presentatore
                    compresa: per mostrare una slide bisognava uscire, cercare il
                    pulsante sotto e tornare. Adesso Slide, Preventivo, Media e
                    Link stanno QUI, e premerne uno fa due cose insieme —
                    ti porta su quella pagina e ci porta la sala.
                    Un pulsante che ne chiede un altro è il modo piu' sicuro di
                    perdere il filo mentre duecento persone aspettano. */}
                {CONTENUTI.map((c) => (
                  <button
                    key={c.percorso}
                    onClick={() => {
                      setScegliendo(false);
                      //  In pagina si cambia la cornice; dentro Meetly si naviga
                      //  davvero, perché li' i contenuti sono la pagina stessa.
                      if (pagina) setPercorsoContenuti(c.percorso);
                      else naviga?.(c.percorso);
                      cambiaVista("contenuti", c.percorso);
                    }}
                    title={`Mostra ${c.testo.toLowerCase()} alla sala`}
                    className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] hover:bg-white/10"
                  >
                    <c.icona className="mr-1 inline h-3.5 w-3.5" />{c.testo}
                  </button>
                ))}
                {/* ── ⚠️ LE TRE SCHERMATE ─────────────────────────────────
                      Sta accanto ai contenuti perché è una domanda sui
                      contenuti — «come si vede quello che sto mostrando» — e
                      non sulla regia. Si accende solo quando c'è qualcosa da
                      vedere: a camera sola non ci sono schermate da
                      confrontare. */}
                {pagina && (
                  <button
                    onClick={() => { setTreSchermate((v) => !v); cambiaVista("contenuti", percorsoContenuti); }}
                    title="Guarda il contenuto su computer, tablet e telefono insieme"
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] transition ${
                      treSchermate ? "border-brand bg-brand/25 text-white" : "border-white/15 hover:bg-white/10"
                    }`}
                  >
                    <LayoutGrid className="mr-1 inline h-3.5 w-3.5" />3 schermate
                  </button>
                )}
                {/* ── ⚠️ QUALE SCHERMATA COMANDI ─────────────────────────
                      Compare solo con le tre schermate accese, e sta qui —
                      dove si guarda — invece che sotto le cornici: lì era
                      un'etichetta piccola che sembrava un'informazione, non un
                      comando. Quello che fai sulla schermata scelta arriva a
                      tutta la sala, non solo a chi ha quel dispositivo. */}
                {/*  ⚠️ Sempre, non solo con le tre schermate: è il comando con
                    cui si sceglie la forma su cui lavorare, e sceglierla apre
                    quella schermata a tutto schermo. Le tre insieme restano il
                    confronto, non il posto in cui si lavora. */}
                {pagina && (
                  <span className="ml-1 inline-flex items-center gap-0.5 rounded-lg border border-white/15 bg-white/[0.04] p-0.5">
                    {([
                      ["desktop", "Computer"],
                      ["tablet", "Tablet"],
                      ["mobile", "Telefono"],
                    ] as const).map(([d, nome]) => (
                      <button
                        key={d}
                        onClick={() => {
                          setComandaSchermo(d);
                          //  ⚠️ Sceglierne uno lo APRE: restare nel confronto
                          //   a tre dopo aver detto «voglio lavorare sul
                          //   telefono» vorrebbe dire lavorare in una
                          //   miniatura, che è il difetto da cui è nata questa
                          //   richiesta.
                          setTreSchermate(false);
                          cambiaVista("contenuti", percorsoContenuti);
                        }}
                        title={`Lavora sulla schermata ${nome.toLowerCase()}`}
                        className={`rounded px-2 py-1 text-[11px] transition ${
                          comandaSchermo === d ? "bg-brand text-white" : "text-white/60 hover:bg-white/10"
                        }`}
                      >
                        {nome}
                      </button>
                    ))}
                  </span>
                )}
                <button onClick={() => cambiaVista("camera")} className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] hover:bg-white/10">
                  <Video className="mr-1 inline h-3.5 w-3.5" />Solo te
                </button>
    </>
  );

  const tastiStrumenti = (
    <>
                {/*  ⚠️ SEMPRE, non solo prima di partire: il link si manda anche
                    a diretta cominciata — «guarda che siamo già in onda» è il
                    messaggio che porta la metà della sala. Prima si copiava solo
                    dalla schermata di partenza, cioè nell'unico momento in cui
                    non serve ancora a nessuno. */}
                <button
                  onClick={() => {
                    const l = modo.sala?.link ?? "";
                    void navigator.clipboard.writeText(l)
                      .then(() => toast.success("Link copiato — mandalo a chi vuoi far entrare"))
                      .catch(() => toast.error("Copialo a mano: " + l));
                  }}
                  title="Copia il link della sala"
                  className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] hover:bg-white/10"
                >
                  <Copy className="mr-1 inline h-3.5 w-3.5" />Condividi
                </button>
                {/* ── ⚠️ QUANDO SI PUÒ CHIEDERE LA PAROLA, LO DECIDI TU ───────
                      Una diretta comincia con una persona che parla e duecento
                      che ascoltano: con le mani aperte dal primo minuto ti trovi
                      la fila piena mentre stai ancora facendo l'introduzione, e
                      devi dire di no a gente che aveva solo seguito un pulsante
                      acceso. Parte chiusa, e la apri quando sei pronto.
                     ⚠️ Il tasto dice lo STATO, non il comando: acceso e verde
                      vuol dire che sono aperte adesso. Un tasto che dice
                      «apri»/«chiudi» costringe a ricordare in quale dei due si
                      trova, e in diretta non si ricorda niente.
                     ⚠️ E C'È SEMPRE, ANCHE PRIMA DI ANDARE IN ONDA. Era legato a
                      `inOnda`, e da lì nascevano due problemi: non lo si poteva
                      preparare prima di cominciare, e soprattutto — se per
                      qualunque ragione la console non si considerava «in onda» —
                      il comando spariva del tutto senza che niente lo dicesse.
                      Un comando che a volte non c'è è peggio di un comando che
                      non funziona: almeno il secondo lo si vede e lo si segnala. */}
                <button
                    onClick={() => {
                      const nuovo = !regiaPalco.maniAperte;
                      setRegiaPalco({ ...regiaPalco, maniAperte: nuovo });
                      void chiedi({ azione: "palcoscenico", codice, maniAperte: nuovo })
                        .then(giro)
                        .catch(() => {
                          //  Il comando non è passato: si rimette com'era, invece
                          //  di lasciare a schermo uno stato che la sala non ha.
                          setRegiaPalco({ ...regiaPalco, maniAperte: !nuovo });
                          toast.error("Non è cambiato: riprova");
                        });
                      toast.success(nuovo ? "Adesso possono chiedere la parola" : "Richieste chiuse");
                    }}
                    title={
                      regiaPalco.maniAperte
                        ? "Gli spettatori possono chiedere la parola. Tocca per chiudere."
                        : "Nessuno può chiedere la parola. Tocca per aprire."
                    }
                    //  ⚠️ ACCESO È VERDE PIENO, non un contorno: è l'unico
                    //   comando qui dentro che cambia cosa possono fare DUECENTO
                    //   persone, e deve leggersi da lontano in quale dei due
                    //   stati si trova senza doverlo cercare.
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                      regiaPalco.maniAperte
                        ? "border-emerald-400 bg-emerald-500/90 text-white shadow-lg shadow-emerald-500/30"
                        : "border-white/25 bg-white/[0.06] text-white/70 hover:bg-white/15"
                    }`}
                  >
                    <Hand className="mr-1 inline h-3.5 w-3.5" />
                    {regiaPalco.maniAperte ? "Mani aperte" : "Mani chiuse"}
                  </button>

                {/* ── ⚠️ LE IMPOSTAZIONI DELLA SALA, QUI ─────────────────────
                      Erano nel pannello «Regia» dentro /CRM/webinar. Chi conduce
                      però sta QUI, a schermo intero, e da qui quel pannello non
                      esiste: il numero che vede la sala, il conto degli iscritti
                      e la soglia erano comandi veri messi in un posto dove non
                      passa nessuno — cioè, in pratica, comandi che non c'erano.
                     Un'impostazione si mette dove si sta lavorando quando viene
                     voglia di cambiarla, e la voglia di cambiare il contatore
                     viene guardando la sala. */}
                <button
                  onClick={() => setImpostazioniAperte((v) => !v)}
                  title="Che numero vede la sala"
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] transition ${
                    impostazioniAperte ? "border-white/40 bg-white/15" : "border-white/15 hover:bg-white/10"
                  }`}
                >
                  <Users className="mr-1 inline h-3.5 w-3.5" />Sala
                </button>

                {/*  ⚠️ SEMPRE, non solo in onda: la domanda «perché non si vede»
                      ci si fa anche appena prima di cominciare, ed è lì che
                      servirebbe di più. */}
                <button
                  onClick={() => setMostraDiagnostica((v) => !v)}
                  title="Perché non si vede una camera: i dati veri, misurati adesso"
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${
                    mostraDiagnostica ? "border-white/40 bg-white/15" : "border-white/15 hover:bg-white/10"
                  }`}
                >
                  <Stethoscope className="mr-1 inline h-3.5 w-3.5" />Perché
                </button>
    </>
  );

  const salottoIntero = (pagina || (inOnda && vista === "salotto" && !scegliendo)) && typeof document !== "undefined"
    ? avvolgi(
        //  ⚠️ Dentro Meetly `bottom-14` lascia scoperta la barra del
        //   presentatore: coprendola, per mostrare una slide bisognava
        //   chiudere lo studio. Come pagina a sé quel problema non esiste e si
        //   prende tutto lo schermo.
        <div className={`flex flex-col bg-[#050f24] text-white ${pagina ? "h-[100dvh]" : "fixed inset-x-0 bottom-14 top-0 z-[120]"}`}>
          {/* ── LA TESTA ─────────────────────────────────────────────── */}
          <div
            ref={barraRef}
            //  ⚠️ Meno margini quando è stretta: quattro punti per lato su un
            //   telefono sono quattro punti in meno per i comandi.
            className={`flex flex-wrap items-center gap-2 border-b border-white/10 py-2.5 ${
              stretta ? "px-2" : "px-4"
            }`}
          >
            <p className="flex items-center gap-2 text-sm font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
              </span>
              {modo.sala?.titolo}
            </p>
            {/*  ⚠️ IL NUMERO SI TOCCA. «137 in sala» è l'informazione che si
                guarda di più durante una diretta, ed era l'unica che non
                portava da nessuna parte: per dare la parola a qualcuno che non
                aveva ancora scritto in chat non c'era strada. */}
            <button
              onClick={() => setElencoAperto((v) => !v)}
              className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] transition hover:bg-white/20"
              title="Vedi chi c'è in sala"
            >
              <Users className="mr-1 inline h-3 w-3" />{regia?.presenti ?? 0} in sala
            </button>
            {inOnda && <span className="text-[11px] text-white/45">{inScena.elenco.length} in onda</span>}
            {!inOnda && <span className="text-[11px] text-amber-300/80">non sei ancora in onda</span>}
            {mani > 0 && (
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] text-amber-200">
                <Hand className="mr-1 inline h-3 w-3" />{mani}
              </span>
            )}

            {/*  ⚠️ Più stretti gli spazi quando lo schermo è stretto: con
                  `gap-1.5` e le due frecce dei cassetti la riga misurava 386
                  punti sui 359 disponibili, e «Termina» andava a capo da solo
                  su una riga tutta sua. Ventisette punti di troppo costavano
                  quaranta punti di altezza. */}
            <div className={`ml-auto flex flex-wrap items-center ${stretta ? "gap-1" : "gap-1.5"}`}>
              {/*  ⚠️ Camera, microfono e registrazione compaiono SOLO a diretta
                  avviata: prima non c'è niente da accendere o spegnere, e tre
                  pulsanti che non fanno niente accanto a «Termina» facevano
                  sembrare che la diretta fosse già partita — che è esattamente
                  l'equivoco che ha lasciato lo schermo vuoto. */}
              {inOnda && (
                <>
                  <Interruttore acceso={cameraAccesa} icona={cameraAccesa ? Video : VideoOff} titolo="Camera" onClick={() => cambiaTraccia("video")} />
                  <Interruttore acceso={micAcceso} icona={micAcceso ? Mic : MicOff} titolo="Microfono" onClick={() => cambiaTraccia("audio")} />
                  <Interruttore acceso={registro} icona={Circle} titolo={registro ? "Ferma la registrazione" : "Registra"} pericolo onClick={() => (registro ? void fermaRegistrazione() : registra())} />
                </>
              )}
              {/* ── ⚠️ SUGLI SCHERMI STRETTI QUESTI STANNO IN UN CASSETTO ────
                    Quattordici comandi su una riga larga trecentosettantacinque
                    punti andavano a capo QUATTRO volte e si prendevano trecento
                    degli ottocento punti di altezza del telefono: restava una
                    striscia per la scena, ed è il motivo per cui da telefono la
                    regia era scomoda.
                    Quello che resta sempre in vista sono le cose che in diretta
                    si premono senza pensarci — camera, microfono, registra,
                    Termina — più due porte: cosa mando in onda, e gli attrezzi.
                    Tutto il resto sta a un tocco, invece che sempre addosso.
                   ⚠️ I tasti sono SCRITTI UNA VOLTA SOLA e cambiano posto: due
                    copie dello stesso comando vuol dire, il giorno che uno
                    cambia, due comportamenti diversi per lo stesso gesto — la
                    stessa ragione per cui il microfono passa da un comando solo. */}
              {!stretta && tastiContenuti}
              {!stretta && tastiStrumenti}
              {stretta && (
                <>
                  <TastoCassetto
                    aperto={cassetto === "onda"}
                    icona={Presentation}
                    testo="In onda"
                    freccia={false}
                    onClick={() => setCassetto((v) => (v === "onda" ? null : "onda"))}
                  />
                  <TastoCassetto
                    aperto={cassetto === "attrezzi"}
                    icona={SlidersHorizontal}
                    testo="Regia"
                    freccia={false}
                    onClick={() => setCassetto((v) => (v === "attrezzi" ? null : "attrezzi"))}
                  />
                </>
              )}
              {inOnda && (
                <button
                  onClick={() => void fermaTutto()}
                  title="Termina la diretta"
                  //  ⚠️ Sul telefono resta il solo quadrato rosso. Con la
                  //   parola i comandi andavano a capo un'altra volta, e una
                  //   riga in più è quaranta punti tolti alla scena. Il rosso e
                  //   il quadratino di stop non si confondono con nient'altro
                  //   qui dentro — ed è l'unico tasto rosso della barra.
                  className="flex items-center gap-1 rounded-lg border border-rose-400/40 bg-rose-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/25"
                >
                  <Square className="h-3 w-3" />
                  {!stretta && "Termina"}
                </button>
              )}
            </div>
          </div>

          {/*  ⚠️ Si chiude da solo appena premi qualcosa dentro: il tocco sale
                fin qui. Un cassetto che resta aperto sopra la scena dopo che
                l'hai usato copre proprio la cosa che hai appena mandato in
                onda. */}
          {stretta && cassetto && (
            <div
              onClick={() => setCassetto(null)}
              className="flex flex-wrap items-center gap-1.5 border-b border-white/10 bg-black/40 px-3 py-2"
            >
              {cassetto === "onda" ? tastiContenuti : tastiStrumenti}
            </div>
          )}

          {/* ── CHI C'È IN SALA ─────────────────────────────────────────── */}
          {elencoAperto && (
            <div className="max-h-56 overflow-y-auto border-b border-white/10 bg-black/30 px-3 py-2">
              <p className="mb-1.5 text-[11px] text-white/45">
                Tocca un nome per dargli la parola o per gli altri comandi.
              </p>
              {(regia?.elenco ?? []).length === 0 ? (
                <p className="py-2 text-[12px] text-white/35">Ancora nessuno.</p>
              ) : (
                <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {(regia?.elenco ?? []).map((p) => {
                    const suo = regia?.palco.find((x) => x.spettatore === p.spettatore);
                    return (
                      <button
                        key={p.spettatore}
                        onClick={() => setPersona({ spettatore: p.spettatore, nome: p.nome })}
                        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-left text-[12px] transition hover:bg-white/10"
                      >
                        <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                        {suo?.stato === "attesa" && <Hand className="h-3 w-3 shrink-0 text-amber-300" />}
                        {!!suo && suo.stato !== "attesa" && (
                          <span className="shrink-0 rounded bg-emerald-400/20 px-1 text-[9px] font-semibold text-emerald-200">live</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── IL CORPO: le persone a sinistra, la sala a destra ─────── */}
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
              {/* ── ⚠️ DA QUI SI PARTE ──────────────────────────────────────
                  Nella regia il pannellino con «Vai in onda» non esiste più —
                  la regia È la schermata — e senza questo blocco si apriva su
                  uno spazio vuoto, con in testa dei comandi che valgono solo a
                  diretta avviata. Sembrava rotta, e in pratica lo era: non
                  c'era modo di cominciare.
                  Adesso la prima cosa che si vede è la domanda giusta: cosa
                  mando in onda. */}
              {!inOnda && (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
                  <div>
                    <p className="text-base font-medium">Pronto a cominciare</p>
                    <p className="mt-1 text-[13px] text-white/50">
                      Scegli cosa mandare in onda. Il link della sala l&apos;hanno già gli iscritti:
                      appena parti, la vedono.
                    </p>
                  </div>
                  {/*  ⚠️ SONO LE TRE VISTE, non tre sorgenti. Prima c'era «Lo
                      schermo», che apriva la richiesta di condividere il
                      monitor: un ripiego di quando i contenuti non sapevano
                      viaggiare da soli. Adesso le slide arrivano come dato —
                      nitide, e senza mandare in onda le notifiche del sistema
                      — quindi la domanda giusta non è «da dove riprendo» ma
                      «cosa vedono». */}
                  <div className="flex flex-wrap justify-center gap-2">
                    <Partenza icona={LayoutPanelLeft} testo="Contenuti" nota="Slide, preventivo, media" onClick={() => void vai("contenuti")} attesa={collegando} />
                    <Partenza icona={Video} testo="Solo te" nota="Ti vedono e ti sentono" onClick={() => void vai("camera")} attesa={collegando} />
                    <Partenza icona={Users} testo="Salotto" nota="Tu e chi fai salire" onClick={() => void vai("salotto")} attesa={collegando} />
                  </div>
                  {!!modo.sala?.link && (
                    <button
                      onClick={() => { void navigator.clipboard.writeText(modo.sala!.link).then(() => toast.success("Link copiato")).catch(() => toast.error("Copialo a mano")); }}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/10"
                    >
                      <Copy className="mr-1 inline h-3 w-3" /> Copia il link della sala
                    </button>
                  )}
                </div>
              )}

              {/* ── ⚠️ I CONTENUTI DENTRO UNA CORNICE, NON NAVIGANDOCI ──────
                  È la differenza fra la regia e il pannello dentro Meetly: qui
                  la pagina delle slide sta DENTRO lo studio, quindi si comanda
                  senza andarsene — e senza andarsene non si smonta niente, che
                  era la causa del pannello che tornava a «Solo te».
                  ⚠️ `?regia=` e non `?webinar=`: dentro la regia questa pagina
                   PUBBLICA quello che fai; con l'altra parola seguirebbe sé
                   stessa e nella sala non arriverebbe mai niente. */}
              {inOnda && pagina && vista === "contenuti" && !treSchermate && (
                <SchermataSola
                  percorso={percorsoContenuti}
                  codice={codice}
                  dispositivo={comandaSchermo}
                />
              )}

              {/* ── ⚠️ LE TRE SCHERMATE INSIEME ─────────────────────────────
                    Una sola comanda — quella del computer, con `?regia=` — e
                    le altre due GUARDANO, con `?webinar=`, esattamente come
                    fa la sala. Non è un dettaglio: tre cornici che pubblicano
                    tutte insieme si sovrascriverebbero a vicenda, e la sala
                    vedrebbe l'ultima che ha parlato. Così invece tablet e
                    telefono mostrano quello che sta ARRIVANDO davvero — che
                    è poi la cosa che si vuole controllare. */}
              {inOnda && pagina && vista === "contenuti" && treSchermate && (
                <TreSchermate
                  percorso={percorsoContenuti}
                  codice={codice}
                  comanda={comandaSchermo}
                  setComanda={setComandaSchermo}
                />
              )}

              {/* ── ⚠️ CHI CONDUCE STA SEMPRE IN CIMA, E SEMPRE NELLO STESSO
                  POSTO. Non è una griglia come quella degli ospiti: è una
                  fascia con un'altezza fissa, che si divide fra quanti sono —
                  intera se sei solo, a metà in due, in tre in tre. Chi guarda
                  impara in dieci secondi dove sono le facce che contano, e da
                  lì in poi non le cerca più.
                  E chi parla si allarga: gli altri restano una striscia, non
                  spariscono, perché in un programma a due voci metà del valore
                  è la faccia dell'altro mentre ascolta. */}
              {/* ── ⚠️ LA SCENA: METÀ A TE, METÀ A CHI PARLA ──────────────────
                    Era sbagliata, e si vedeva: tu in un riquadro in mezzo allo
                    schermo e l'ospite sotto, a TUTTA larghezza e alto il doppio
                    del tuo. Chi conduce diventava il riquadro piccolo della
                    propria diretta.
                    La causa: la fascia dei relatori aveva un'altezza in
                    percentuale e la griglia degli ospiti prendeva «tutto quello
                    che resta» — cioè quasi tutto. Adesso vale la stessa regola
                    della sala (`webinar/palco-tetris`): la scena si divide in
                    due — tu e chi sta parlando — e gli altri stanno in una
                    fila sotto, alta quanto serve a riconoscere una faccia.
                   ⚠️ Con i contenuti davanti la scena si stringe a una striscia:
                    in quel momento la cosa che si guarda è quello che mostri. */}
              {/* ── ⚠️ LA SCENA È UN RIQUADRO, NON UNA STRISCIA ────────────────
                    Era alta una percentuale e larga tutto lo schermo: su un
                    monitor da 1450 quel rettangolo è 3,5:1, e dentro ci sta un
                    16:9 largo 740 — con settecento punti di nero ai lati. Da lì
                    l'impressione di «riquadretto in mezzo allo schermo».
                    Adesso la scena prende l'altezza che avanza e dentro c'è un
                    riquadro 16:9 centrato: si incastra, e il nero sparisce.
                   ⚠️ Con i contenuti davanti resta una striscia bassa: in quel
                    momento la cosa che si guarda è quello che mostri. */}
              {/* ── ⚠️ FACCIA A FACCIA: DUE QUADRATI UGUALI ─────────────────
                    Prende il posto della scena, non ci si aggiunge sopra. La
                    forma la decide `duello` in `webinar/palco-tetris`, la
                    STESSA funzione che usa la sala: se la console calcolasse la
                    sua, chi conduce vedrebbe un dibattito e il pubblico un
                    altro — ed è la stessa ragione per cui `chiVaInOnda` sta in
                    un posto solo. */}
              {/* ── ⚠️ COL CONTENUTO IN ONDA LE CAMERE SI FANNO PICCOLE ────
                    Una fila sola, tutte della stessa misura, e basta: niente
                    scena grande, niente faccia a faccia, niente seconda fila.
                    Prima ognuno di quei tre montaggi si prendeva la sua
                    altezza — la scena il 22%, il faccia a faccia TUTTO lo
                    spazio, la fila altri centoquaranta punti — e sommati
                    lasciavano al contenuto una striscia, o niente. È il
                    «si bugga tutto quando ci sono persone nel salotto mentre
                    condivido».
                   ⚠️ Novantasei punti: si riconosce una faccia, si vede chi
                    parla dal contorno verde, e la slide si prende tutto il
                    resto. Mentre mostri qualcosa le camere servono a
                    CONTROLLARE, non a guardare — quello lo fa la sala, e lì
                    infatti spariscono del tutto. */}
              {inOnda && contenutiInOnda && camere.length > 0 && (
                <div className="flex shrink-0 items-stretch gap-1.5 overflow-x-auto" style={{ height: 96 }}>
                  {camere.map((c) => (
                    <div key={c.chiave} className="h-full shrink-0" style={{ aspectRatio: "16 / 9" }}>
                      <GrigliaCamere
                        camere={[c]}
                        salotto
                        larghezza={largo}
                        onTocco={versoIlPrimoPiano}
                        onMuto={(chiave, acceso) => comandiPersona.microfono(chiave, acceso)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {inOnda && !contenutiInOnda && !!sfidanteConsole && (
                <div ref={scenaRef} className="mx-auto flex min-h-0 w-full min-w-0 flex-1 items-center justify-center">
                  <div className={`flex gap-1.5 ${duoConsole.orientamento === "fianco" ? "flex-row" : "flex-col"}`}>
                    <div
                      style={duoConsole.lato ? { width: duoConsole.lato, height: duoConsole.lato } : { width: "45%", aspectRatio: "1 / 1" }}
                      className="overflow-hidden rounded-2xl"
                    >
                      <GrigliaCamere camere={camere.filter((c) => c.mia)} salotto larghezza={largo} riempi />
                    </div>
                    <div
                      style={duoConsole.lato ? { width: duoConsole.lato, height: duoConsole.lato } : { width: "45%", aspectRatio: "1 / 1" }}
                      className="overflow-hidden rounded-2xl"
                    >
                      <GrigliaCamere
                        camere={camere.filter((c) => c.chiave === sfidanteConsole.spettatore)}
                        salotto
                        larghezza={largo}
                        riempi
                        onMuto={(chiave, acceso) => comandiPersona.microfono(chiave, acceso)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {inOnda && !contenutiInOnda && !sfidanteConsole && (
                <div
                  ref={scenaRef}
                  className={`mx-auto flex min-h-0 w-full min-w-0 items-stretch justify-center gap-1.5 ${
                    disposizione.orientamento === "fianco" ? "flex-row" : "flex-col"
                  //  ⚠️ Non c'è più il caso «22% perché ci sono i contenuti»:
                  //   col contenuto in onda questa scena non si disegna
                  //   affatto, al suo posto c'è la fila di miniature. Lasciare
                  //   qui la condizione voleva dire una riga che non può mai
                  //   essere vera, e il prossimo che legge la crede viva.
                  } flex-1`}
                >
                  <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
                    <div
                      style={
                        riquadroConduce.larghezza
                          ? { width: riquadroConduce.larghezza, height: riquadroConduce.altezza }
                          : { width: "100%", aspectRatio: "16 / 9" }
                      }
                    >
                      <FasciaRelatori
                        relatori={relatori}
                        logo={logoStudio}
                        soloChiParla={regiaPalco.soloChiParla}
                        larghezza={largo}
                      />
                    </div>
                  </div>

                  {/*  L'ospite in primo piano prende l'altra metà, non tutta la
                        pagina: è metà scena, non la scena. */}
                  {disposizione.modo === "duo" && !!ospiteGrandeConsole && (
                    <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
                      <div
                        //  ⚠️ Stessa misura di chi conduce, non una sua: le due
                        //   metà sono `flex-1` nella stessa riga, quindi hanno
                        //   lo stesso spazio. Misurarle due volte vuol dire
                        //   solo due occasioni di venire fuori diverse.
                        style={
                          riquadroConduce.larghezza
                            ? { width: riquadroConduce.larghezza, height: riquadroConduce.altezza }
                            : { width: "100%", aspectRatio: "16 / 9" }
                        }
                      >
                      <GrigliaCamere
                        camere={camere.filter((c) => c.chiave === ospiteGrandeConsole.spettatore)}
                        salotto
                        larghezza={largo}
                        onTocco={versoIlPrimoPiano}
                        onMuto={(chiave, acceso) => comandiPersona.microfono(chiave, acceso)}
                      />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── ⚠️ UNA FILA DI RIQUADRI, NON UNA GRIGLIA ───────────────────
                    Usavo `GrigliaCamere` per la fila, e quel componente è fatto
                    per una GRIGLIA: con un ospite solo lo apre a tutta
                    larghezza — è quello che si vedeva, un riquadro nero da
                    1450×430 sotto un presentatore da 740. Non era l'altezza
                    sbagliata: era il componente sbagliato.
                    Qui ogni ospite è un riquadro 16:9 alto quanto la fila,
                    affiancato agli altri, e se non ci stanno si scorre — la
                    stessa cosa che fa la sala. */}
              {inOnda && !contenutiInOnda && ospitiPiccoliConsole.length > 0 && (
                <div
                  className="flex shrink-0 items-stretch gap-1.5 overflow-x-auto"
                  style={{ height: disposizione.altezzaFila }}
                >
                  {camere
                    .filter((c) => ospitiPiccoliConsole.some((p) => p.spettatore === c.chiave))
                    .map((c) => (
                      <div key={c.chiave} className="h-full shrink-0" style={{ aspectRatio: "16 / 9" }}>
                        <GrigliaCamere
                          camere={[c]}
                          salotto
                          larghezza={largo}
                          onTocco={versoIlPrimoPiano}
                          //  ⚠️ Passa dallo STESSO comando del pannello persona:
                          //   due strade per chiudere lo stesso microfono vuol
                          //   dire, il giorno che una cambia, due comportamenti
                          //   diversi per lo stesso gesto.
                          onMuto={(chiave, acceso) => comandiPersona.microfono(chiave, acceso)}
                        />
                      </div>
                    ))}
                </div>
              )}

              {/* ── LA REGIA: UNA RIGA DI PERSONE ──────────────────────
                    ⚠️ QUI C'ERANO «1 2 3 4 · Tutti», e contavano invece di far
                     scegliere. Il perché sono sbagliati alla radice — e non
                     nel disegno — sta in `webinar/regia-palco`. In breve: con
                     «2» non decidi CHI va in onda, decidi quanti e la scelta
                     la fa l'ordine di arrivo; e quando qualcuno sale o scende
                     restano due, ma sono due PERSONE diverse — il montaggio
                     cambia da solo e lo scopri guardando la sala.
                    ⚠️ E soprattutto non si vedeva chi era dentro e chi fuori.
                     Un comando che non mostra il suo effetto va ricordato a
                     memoria, e in diretta non si ricorda niente.
                    Adesso c'è una riga per il palco: una persona per pastiglia,
                     con due gesti — la mette in onda, o la fa grande. */}
              {inOnda && barraRegia}
            </div>

            {/* ── LA SALA: chi c'è, chi chiede la parola, cosa scrivono ── */}
            <aside className="flex min-h-0 w-full flex-col border-white/10 lg:w-[24rem] lg:border-l">
              {/*  ⚠️ SOPRA LA CHAT, non sopra il video: mentre parli guardi il
                  copione e tieni d'occhio la sala nello STESSO momento, e
                  quale delle due conti di più cambia ogni cinque minuti. Si
                  tira per l'altezza dalla maniglia, e la misura resta. */}
              {gobbo && <Teleprompter chiudi={() => setGobbo(false)} nomePresentatore={nomePresentatore} />}
              {!!regia?.palco.length && (
                <div className="border-b border-white/10 px-2 py-2">
                  <ElencoPalco palco={regia.palco} comandi={comandi} />
                </div>
              )}
              <ChatSala messaggi={regia?.messaggi ?? []} palco={regia?.palco ?? []} comandi={comandi} className="min-h-0 flex-1" />
              <div className="flex gap-1.5 border-t border-white/10 p-2">
                <input
                  value={bozza}
                  onChange={(e) => setBozza(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void invia()}
                  placeholder="Scrivi alla sala…"
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-xs outline-none placeholder:text-white/30 focus:border-brand"
                />
                <button onClick={() => void invia()} disabled={!bozza.trim()} className="rounded-lg bg-brand px-2.5 text-white disabled:opacity-40">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </aside>
          </div>
        </div>,
      )
    : null;

  const fasciaScelta = scegliendo && typeof document !== "undefined"
    ? createPortal(
        <div className="fixed inset-x-0 top-0 z-[110] flex flex-wrap items-center gap-2 border-b border-brand/40 bg-brand/20 px-4 py-2 text-white backdrop-blur-md">
          <LayoutPanelLeft className="h-4 w-4 shrink-0" />
          <p className="min-w-0 flex-1 text-[12px] leading-snug">
            <b>Scegli cosa mostrare</b> dalla barra in basso — slide, preventivo, media, un link.
            <span className="text-white/70"> Fino ad allora la sala continua a vedere il salotto.</span>
          </p>
          <button
            onClick={() => setScegliendo(false)}
            className="rounded-lg border border-white/25 px-2.5 py-1 text-[11px] hover:bg-white/15"
          >
            Torna al salotto
          </button>
        </div>,
        document.body,
      )
    : null;

  const pannelloPersona = persona ? (
    <PannelloPersona
      spettatore={persona.spettatore}
      nome={persona.nome}
      inPalco={regia?.palco.find((p) => p.spettatore === persona.spettatore) ?? null}
      comandi={comandiPersona}
      inDuello={regiaPalco.facciaAFaccia === persona.spettatore}
      fuoriCampo={
        Array.isArray(regiaPalco.mostrati) && !regiaPalco.mostrati.includes(persona.spettatore)
      }
      chiudi={() => setPersona(null)}
    />
  ) : null;

  return (
    <>
      {salottoIntero}
      {fasciaScelta}

      {/* ── ⚠️ I DUE PANNELLI STANNO QUI, FUORI DA TUTTO ──────────────────
            Erano dentro il ramo `{!salottoIntero && ...}`, cioè la finestrella
            dentro Meetly. Ma chi conduce sta sullo STUDIO a schermo intero, che
            rende l'altro albero: i pulsanti «Sala» e «Perché» c'erano nella
            barra e premendoli non succedeva niente, perché il pannello era
            montato in un ramo che quella schermata non disegna.
            Segnalato due volte come «non si vede il contatore» e una come «non
            vedo il pulsante»: funzionavano tutti, erano nel posto sbagliato.
           ⚠️ Sono finestre sopra la console: il loro posto è la radice, non un
            ramo. Un pannello che vive dentro una delle due forme della console
            funziona in una e sparisce nell'altra, e la differenza non si vede
            leggendo il codice — si vede solo aprendo la schermata giusta. */}
      {impostazioniAperte && (
        <ImpostazioniSala codice={codice} onChiudi={() => setImpostazioniAperte(false)} />
      )}

      {mostraDiagnostica && (
        <PannelloDiagnostica
          dati={{ persone: fattiPalco, costruito: VERSIONE }}
          onChiudi={() => setMostraDiagnostica(false)}
        />
      )}
      {/*  ⚠️ FUORI dal pannello sfocato, come il palco: `backdrop-filter` fa
          da riferimento ai `fixed` che contiene, e il pannello persona
          finirebbe ritagliato dentro la colonna della chat. */}
      {pannelloPersona && typeof document !== "undefined" && createPortal(pannelloPersona, document.body)}
      {/*  ⚠️ A salotto aperto il pannello sparisce: dentro lo studio c'è già
          tutto — chat, sala, regia, comandi — e tenerne due copie a schermo
          vorrebbe dire due caselle di testo in cui scrivere alla stessa sala. */}
      {!salottoIntero && (
    <aside
      className="fixed right-3 top-24 z-[90] flex max-h-[calc(100vh-8rem)] w-[21rem] flex-col overflow-hidden rounded-2xl border border-white/15 text-white shadow-2xl"
      //  ⚠️ 0.76, ED È UN NUMERO MISURATO, non scelto a occhio.
      //   Il caso peggiore è la console sopra il PREVENTIVO, che è bianco: lì
      //   il velo scuro si schiarisce fino a diventare un grigio medio, e il
      //   testo chiaro sopra ci sparisce dentro. Contrasto reale del corpo del
      //   testo, calcolato sul colore che esce davvero dalla sovrapposizione:
      //     0.62 → 4.27  (sotto la soglia di 4.5: era illeggibile)
      //     0.70 → 5.48
      //     0.76 → 6.76  ← qui, e resta il 24% di trasparenza
      //     0.88 → 10.02 (leggibile, ma ormai è un pannello opaco)
      //   Si vede ancora la pagina dietro — che è la richiesta — e la chat si
      //   legge senza strizzare gli occhi, che è la ragione per cui la chat sta
      //   lì. Più trasparente di così una delle due cose si perde.
      style={{ backgroundColor: "rgba(11, 20, 38, 0.76)", backdropFilter: "blur(14px)" }}
    >
      {/*  ⚠️ Le voci di chi è salito devono uscire da QUALCOSA: senza questo
          elemento arrivano al presentatore e non le sente nessuno — lui
          compreso, che è l'unico che deve rispondere. */}
      <audio ref={attaccaFlusso(suonoOspiti.current)} autoPlay className="hidden" />

      {/* ── TESTA ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Radio className={`h-4 w-4 ${inOnda ? "text-rose-400" : "text-white/40"}`} />
        <p className="min-w-0 flex-1 truncate text-xs font-semibold">{modo.sala.titolo}</p>
        <button onClick={() => impostaModo({ consoleAperta: false })} className="rounded p-1 text-white/50 hover:bg-white/10" aria-label="Riduci">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => { void fermaTutto().then(() => impostaModo({ sala: null })); }}
          className="rounded p-1 text-white/50 hover:bg-white/10"
          aria-label="Esci dalla sala"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── I NUMERI ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-white/50" /><b className="tabular-nums">{regia?.presenti ?? 0}</b> in sala</span>
        <span className="text-white/50">·</span>
        <span className="text-white/70">{regia?.passate ?? 0} passate</span>
        {mani > 0 && (
          <span className="ml-auto flex items-center gap-1 rounded bg-amber-400/20 px-1.5 py-0.5 text-amber-200">
            <Hand className="h-3 w-3" /> {mani}
          </span>
        )}
      </div>

      {/* ── ANDARE IN ONDA ───────────────────────────────────────────── */}
      {/* ══ IL TUO DISPOSITIVO ═══════════════════════════════════════════
          Quello che parte da QUI: la tua camera, il tuo microfono, la
          registrazione. Separato da quello che vedono loro, perché sono due
          domande diverse — «sono acceso?» e «cosa stanno guardando?» — e
          tenerle nello stesso gruppo era la ragione per cui si spegneva la
          camera credendo di cambiare schermata. */}
      <div className="space-y-1.5 border-b border-white/10 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">Il tuo dispositivo</p>
        {!inOnda ? (
          <button
            onClick={() => void vai()}
            disabled={collegando}
            className="w-full rounded-lg bg-brand px-3 py-2 text-[12px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {collegando ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : <Radio className="mr-1 inline h-3.5 w-3.5" />}
            {collegando ? "Ti collego…" : "Vai in onda"}
          </button>
        ) : (
          <div className="flex gap-1.5">
            <Interruttore
              acceso={cameraAccesa}
              icona={cameraAccesa ? Video : VideoOff}
              titolo={cameraAccesa ? "Spegni la camera" : "Riaccendi la camera"}
              onClick={() => cambiaTraccia("video")}
            />
            <Interruttore
              acceso={micAcceso}
              icona={micAcceso ? Mic : MicOff}
              titolo={micAcceso ? "Chiudi il microfono" : "Riapri il microfono"}
              onClick={() => cambiaTraccia("audio")}
            />
            <Interruttore
              acceso={registro}
              icona={Circle}
              titolo={registro ? "Ferma la registrazione" : "Registra"}
              pericolo
              onClick={() => (registro ? void fermaRegistrazione() : registra())}
            />
            <button
              onClick={() => void fermaTutto()}
              title="Termina la diretta"
              className="flex-1 rounded-lg border border-rose-400/40 bg-rose-500/15 px-2 py-1.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/25"
            >
              <Square className="mr-1 inline h-3 w-3" />
              {registro ? `${Math.floor(durata / 60)}:${String(durata % 60).padStart(2, "0")}` : "Termina"}
            </button>
          </div>
        )}
      </div>

      {/* ══ SULLO SCHERMO DI CHI TI GUARDA ═══════════════════════════════
          ⚠️ NON C'È PIÙ LA CONDIVISIONE SCHERMO, ed è un passo avanti. Con lo
           schermo condiviso la sala vedeva una FOTOGRAFIA della tua finestra:
           sfocata sul testo, con le tue notifiche dentro, e su un telefono
           illeggibile. Adesso vedono la PAGINA VERA — slide, preventivo,
           media, link — ognuno alla risoluzione del proprio schermo, e chi
           guarda dal telefono la vede impaginata per il telefono.
          E il cambio pagina li segue da solo: cambiando scheda qui, la sala
           cambia con te senza che tu debba ripremere niente. */}
      {inOnda && (
        <div className="space-y-1.5 border-b border-white/10 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">Sullo schermo di chi ti guarda</p>
          <div className="grid grid-cols-3 gap-1.5">
            <Vista attiva={vista === "contenuti"} icona={LayoutPanelLeft} testo="Contenuti" onClick={() => cambiaVista("contenuti")} />
            <Vista attiva={vista === "camera"} icona={Video} testo="Solo te" onClick={() => cambiaVista("camera")} />
            <Vista attiva={vista === "salotto"} icona={Users} testo="Salotto" onClick={() => cambiaVista("salotto")} />
          </div>
          {/*  Le stesse quattro scorciatoie del pannello grande: da qui si
              cambia quello che vede la sala senza cercare la barra. */}
          {vista === "contenuti" && (
            <div className="grid grid-cols-4 gap-1">
              {CONTENUTI.map((c) => (
                <button
                  key={c.percorso}
                  onClick={() => { naviga?.(c.percorso); cambiaVista("contenuti", c.percorso); }}
                  className={`flex flex-col items-center gap-0.5 rounded border px-1 py-1 text-[9px] transition ${
                    percorsoOra === c.percorso ? "border-brand bg-brand/20 text-white" : "border-white/15 text-white/70 hover:bg-white/10"
                  }`}
                >
                  <c.icona className="h-3.5 w-3.5" />
                  {c.testo}
                </button>
              ))}
            </div>
          )}
          <p className="text-[10px] leading-snug text-white/60">
            {vista === "contenuti"
              ? "Seguono le tue pagine: slide, preventivo, media, link. Cambi scheda e cambiano con te."
              : vista === "camera"
                ? "Vedono solo te, grande."
                : `Vedono te e chi è sul palco, alla pari${palcoQuanti ? ` (${palcoQuanti})` : ""}.`}
          </p>
        </div>
      )}

      {/* ══ LE CAMERE ════════════════════════════════════════════════════
          ⚠️ LA TUA SI APRE INSIEME ALLA DIRETTA. Prima andavi in onda e non ti
           vedevi: non sapevi se eri inquadrato, se eri controluce, se la
           camera aveva ripreso il soffitto. È la prima cosa che si guarda in
           qualunque videochiamata, e mancava proprio a chi sta davanti a
           duecento persone.
          In salotto compaiono anche gli altri, con la griglia di Meetly — la
           tua sopra e a tutta larghezza, perché sei tu che conduci. */}
      {inOnda && camere.length > 0 && (
        <div className="space-y-1.5 border-b border-white/10 px-2 py-2">
          <GrigliaCamere
            camere={camere}
            salotto={vista === "salotto"}
            //  ⚠️ Niente larghezza: in console i riquadri sono miniature di
            //   servizio in un pannello stretto, e vanno bene piccole. La
            //   larghezza la passa la SALA, dove sono la cosa che si guarda.
            onTocco={vista === "salotto" ? versoIlPrimoPiano : undefined}
          />

          {/* ── LE PERSONE IN ONDA ────────────────────────────────────────
              ⚠️ È LA STESSA RIGA della console a schermo intero, scritta una
               volta sola: erano due copie con due comportamenti — quella grande
               aveva «Solo io», questa no — e il giorno che una cambiava, l'altra
               restava indietro in silenzio. Chi resta fuori NON viene buttato
               giù dal palco: continua a sentirvi e a poter parlare, non si vede
               e basta — che è la differenza fra una regia e una porta. */}
          {vista === "salotto" && suPalco.length > 0 && barraRegia}
        </div>
      )}

      {/* ── COME LO VEDONO ───────────────────────────────────────────────
          Il pulsante resta anche dopo aver chiuso l'anteprima: la domanda
          «si vedrà?» torna a ogni schermata nuova, non una volta sola. */}
      {inOnda && vista === "contenuti" && (
        <button
          onClick={() => setAnteprimaAperta(true)}
          className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-left text-[11px] text-white/70 hover:bg-white/[0.06]"
        >
          <MonitorSmartphone className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            Come lo vedono
            {regia?.schermi && (
              <span className="text-white/45">
                {" — "}
                {[
                  regia.schermi.telefono ? `${regia.schermi.telefono} da telefono` : "",
                  regia.schermi.tablet ? `${regia.schermi.tablet} da tablet` : "",
                  regia.schermi.grande ? `${regia.schermi.grande} da schermo grande` : "",
                ].filter(Boolean).join(", ") || "conto ancora aperto"}
              </span>
            )}
          </span>
        </button>
      )}

      {/* ── IL PALCO ─────────────────────────────────────────────────── */}
      {!!regia?.palco.length && (
        <div className="border-b border-white/10 px-2 py-2">
          <ElencoPalco palco={regia.palco} comandi={comandi} />
        </div>
      )}

      {/* ── LA CHAT ──────────────────────────────────────────────────── */}
      <ChatSala messaggi={regia?.messaggi ?? []} palco={regia?.palco ?? []} comandi={comandi} className="min-h-0 flex-1" />

      {specchioAperto && !!codice && (
        <SpecchioSala codice={codice} onChiudi={() => setSpecchioAperto(false)} />
      )}

      {anteprimaAperta && vista === "contenuti" && (
        <AnteprimaFormati
          percorso={percorsoOra}
          schermi={regia?.schermi ?? null}
          onChiudi={() => setAnteprimaAperta(false)}
        />
      )}

      <div className="flex gap-1.5 border-t border-white/10 p-2">
        <input
          value={bozza}
          onChange={(e) => setBozza(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void invia()}
          placeholder="Scrivi alla sala…"
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-xs outline-none placeholder:text-white/30 focus:border-brand"
        />
        <button onClick={() => void invia()} disabled={!bozza.trim()} className="rounded-lg bg-brand px-2.5 text-white disabled:opacity-40">
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
      )}
    </>
  );
}

/** Un interruttore del proprio dispositivo. Spento si vede che è spento: il
 *  guasto classico di questi comandi è non capire se sei in muto, e lo si
 *  scopre dopo trenta secondi di parole nel vuoto. */
/** L'indirizzo corrente, senza dipendere dal router. Vedi la nota in
 *  `ConsoleSala` sul perché non si usa `useRouterState`. */
function usePercorso(): string {
  const [p, setP] = useState(() => (typeof window === "undefined" ? "" : window.location.pathname));
  useEffect(() => {
    const guarda = () => setP((v) => (v === window.location.pathname ? v : window.location.pathname));
    const t = setInterval(guarda, 500);
    //  `popstate` copre indietro/avanti del browser; l'intervallo copre le
    //  navigazioni dell'applicazione, che non emettono nessun evento.
    window.addEventListener("popstate", guarda);
    return () => { clearInterval(t); window.removeEventListener("popstate", guarda); };
  }, []);
  return p;
}

/** ── LA PORTA DI UN CASSETTO ───────────────────────────────────────────────
 *  ⚠️ Acceso quando è aperto, e non a caso: sono i due tasti che sugli schermi
 *   stretti fanno comparire e sparire mezza barra. Senza un segno di quale dei
 *   due è aperto, premere il secondo mentre il primo è aperto sembra non aver
 *   fatto niente — i tasti sotto cambiano ma nessuno li stava guardando. */
function TastoCassetto({
  aperto, icona: Icona, testo, onClick, freccia = true,
}: { aperto: boolean; icona: typeof Video; testo: string; onClick: () => void; freccia?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={aperto ? `Chiudi ${testo.toLowerCase()}` : testo}
      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
        aperto ? "border-white/40 bg-white/15 text-white" : "border-white/15 text-white/80 hover:bg-white/10"
      }`}
    >
      <Icona className="h-3.5 w-3.5" />
      {testo}
      {/*  ⚠️ La freccia sparisce dove i punti contano: quale dei due cassetti
            è aperto lo dice già il fondo acceso, e senza la freccia «Termina»
            resta sulla stessa riga invece di prendersene una tutta sua. */}
      {freccia && <ChevronDown className={`h-3 w-3 transition ${aperto ? "rotate-180" : ""}`} />}
    </button>
  );
}

/** Un modo di andare in onda. Grande, con sotto scritto cosa vedranno: la
 *  differenza fra «camera» e «schermo» la sa chi l'ha già fatto, non chi apre
 *  la regia la prima volta cinque minuti prima di cominciare. */
function Partenza({
  icona: Icona, testo, nota, onClick, attesa,
}: { icona: typeof Video; testo: string; nota: string; onClick: () => void; attesa?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={attesa}
      className="flex w-36 flex-col items-center gap-1.5 rounded-xl border border-white/15 px-3 py-4 transition hover:border-brand hover:bg-brand/10 disabled:opacity-40"
    >
      {attesa ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icona className="h-5 w-5" />}
      <span className="text-[13px] font-medium">{testo}</span>
      <span className="text-[10px] leading-tight text-white/45">{nota}</span>
    </button>
  );
}

function Interruttore({
  acceso, icona: Icona, titolo, onClick, pericolo,
}: { acceso: boolean; icona: typeof Video; titolo: string; onClick: () => void; pericolo?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={titolo}
      aria-label={titolo}
      aria-pressed={acceso}
      className={`rounded-lg border px-2.5 py-1.5 transition ${
        !acceso
          ? "border-white/15 bg-white/[0.04] text-white/40 hover:bg-white/10"
          : pericolo
            ? "border-rose-400/50 bg-rose-500/20 text-rose-300"
            : "border-white/25 bg-white/15 text-white"
      }`}
    >
      <Icona className={`h-4 w-4 ${pericolo && acceso ? "animate-pulse fill-current" : ""}`} />
    </button>
  );
}

/** Una delle tre cose che la sala può avere sullo schermo. */
function Vista({
  attiva, icona: Icona, testo, onClick,
}: { attiva: boolean; icona: typeof Video; testo: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={attiva}
      className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[10px] font-medium transition ${
        attiva ? "border-brand bg-brand text-white" : "border-white/15 text-white/70 hover:bg-white/10"
      }`}
    >
      <Icona className="h-4 w-4" />
      {testo}
    </button>
  );
}

/** ── LE IMPOSTAZIONI DELLA SALA, DALLA CONSOLE ─────────────────────────────
 *  Che numero vede il pubblico, e da quante persone in su mostrarlo.
 *
 *  ⚠️ STA QUI E NON NEL PANNELLO «REGIA» perché è qui che si sta quando viene
 *   voglia di cambiarlo. Le stesse tre impostazioni esistevano già, dentro
 *   /CRM/webinar: chi conduce però sta a schermo intero su /regia/<codice>, e
 *   da lì quel pannello non esiste. Erano comandi veri in un posto dove non
 *   passa nessuno — cioè, in pratica, comandi che non c'erano. Segnalato dal
 *   committente per due volte come «non si vede il contatore»: il contatore
 *   funzionava, era la manopola a essere irraggiungibile.
 *
 *  ⚠️ I DUE NUMERI SONO VERI, e il terzo lo scrive chi conduce ed è etichettato
 *   per quello che è. Non c'è un modo per far comparire un numero di persone
 *   collegate diverso da quelle collegate: quel numero lo leggono i clienti
 *   mentre decidono, e un contatore che oscilla per sembrare vivo è la cosa di
 *   cui, in una sala con tre messaggi in chat, qualcuno si accorge sempre.
 */
function ImpostazioniSala({ codice, onChiudi }: { codice: string; onChiudi: () => void }) {
  const [modo, setModo] = useState<"adesso" | "totale" | "iscritti" | "niente">("adesso");
  const [iscritti, setIscritti] = useState("");
  const [soglia, setSoglia] = useState("1");
  const [caricato, setCaricato] = useState(false);

  //  Si legge lo stato VERO della sala prima di mostrare qualcosa: un pannello
  //  che si apre su valori inventati fa premere «salva» su una scelta che non
  //  è quella attiva.
  useEffect(() => {
    void fetch(`/api/public/webinar?codice=${encodeURIComponent(codice)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        setModo((j.contatore as never) ?? "adesso");
        setIscritti(String(j.sala?.iscritti ?? "") || "");
        setSoglia(String(j.sala?.sogliaVisibile ?? 1));
      })
      .catch(() => { /* si può impostare lo stesso */ })
      .finally(() => setCaricato(true));
  }, [codice]);

  const salva = async (patch: { modo?: typeof modo; iscritti?: string; soglia?: string }) => {
    const m = patch.modo ?? modo;
    try {
      await chiedi({ azione: "contatore", codice, contatore: m, iscritti: Number(patch.iscritti ?? iscritti) || 0 });
      if (patch.soglia !== undefined) {
        await chiedi({ azione: "soglia", codice, soglia: Number(patch.soglia) || 1 });
      }
      toast.success("Salvato");
    } catch {
      toast.error("Non è stato salvato: riprova");
    }
  };

  return (
    <div className="fixed inset-x-3 top-16 z-[200] mx-auto max-w-md rounded-xl border border-white/15 bg-[#07142c]/97 p-4 shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <p className="text-[13px] font-semibold">Che numero vede la sala</p>
        <button onClick={onChiudi} className="ml-auto rounded-lg border border-white/15 p-1 hover:bg-white/10">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {([
          ["adesso", "Quanti ci sono adesso"],
          ["totale", "Quanti sono passati"],
          ["iscritti", "Quanti si sono iscritti"],
          ["niente", "Nessun numero"],
        ] as const).map(([v, testo]) => (
          <button
            key={v}
            disabled={!caricato}
            onClick={() => { setModo(v); void salva({ modo: v }); }}
            className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] transition disabled:opacity-40 ${
              modo === v ? "border-white bg-white text-[#07142c]" : "border-white/20 hover:bg-white/10"
            }`}
          >
            {testo}
          </button>
        ))}
      </div>

      {modo === "iscritti" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
          <span className="text-[12px]">Iscritti</span>
          <input
            value={iscritti}
            onChange={(e) => setIscritti(e.target.value.replace(/\D/g, "").slice(0, 5))}
            onBlur={() => void salva({})}
            inputMode="numeric"
            placeholder="0"
            className="w-20 rounded border border-white/20 bg-transparent px-2 py-1 text-center text-[12px] tabular-nums outline-none focus:border-white"
          />
          <span className="text-[11px] text-white/45">
            In sala compare «{iscritti || "0"} iscritti».
          </span>
        </div>
      )}

      {/*  ⚠️ LA SOGLIA È QUI PERCHÉ È LA COSA CHE NASCONDE IL NUMERO. Averla
            altrove vuol dire scegliere cosa mostrare e poi non vedere niente,
            senza capire perché — è successo per due giorni con la soglia a
            340. */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <span className="text-[12px] text-white/70">Mostralo da</span>
        <input
          value={soglia}
          onChange={(e) => setSoglia(e.target.value.replace(/\D/g, "").slice(0, 5))}
          onBlur={() => void salva({ soglia })}
          inputMode="numeric"
          className="w-16 rounded border border-white/20 bg-transparent px-2 py-1 text-center text-[12px] tabular-nums outline-none focus:border-white"
        />
        <span className="text-[11px] text-white/45">persone in su. Con 1 si vede sempre.</span>
      </div>
    </div>
  );
}
