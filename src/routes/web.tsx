import { createFileRoute , useNavigate } from "@tanstack/react-router";
import { sfx } from "@/shop/sfx";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveId, watchId as getWatch, useLiveNav } from "@/shop/live";
import { useConsultant } from "@/shop/consultant";
//  Pigra: il pacchetto della barra non deve finire in quello della pagina,
//  che la apre anche il cliente (vedi shop/BarraPresentatore).
import { BarraPresentatore as PresenterBar } from "@/shop/BarraPresentatore";
import { DeviceFrame } from "@/shop/DeviceFrame";
import { loadYT, youtubeId, type YTPlayer } from "@/shop/youtube";
import { useSpeaking, DUCK_FACTOR } from "@/shop/duck";
import { resetOwnZoom, guestContentSeen, useGuestChannel } from "@/shop/call";
import { readAnchor, applyAnchor, applyRatio, logOut } from "@/shop/scrollsync";
import { Toaster } from "@/components/ui/sonner";
import { Radio, Link2, Play, Trash2, Globe, Youtube, Volume2, VolumeX, Settings } from "lucide-react";

export const Route = createFileRoute("/web")({
  head: () => ({ meta: [{ title: "Presentazione — Hair Genius Labs" }, { name: "robots", content: "noindex" }] }),
  component: () => <DeviceFrame><WebPage /></DeviceFrame>,
});

interface Lnk { name: string; url: string }
type Kind = "youtube" | "video" | "site" | "";
function kindOf(url: string): Kind {
  if (!url) return "";
  if (youtubeId(url)) return "youtube";
  if (/\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url)) return "video";
  return "site";
}

function WebPage() {
  const navigate = useNavigate();
  const { consultant, ready } = useConsultant();
  const liveId = useLiveId();
  const watch = getWatch();
  // ── CANALE DELL'OSPITE: CODICE VIVO, NON QUELLO DEL LINK ──────────────────
  //  Se il presentatore rigenera la sessione (Termina → Videochiamata, o "Nuova"),
  //  il codice cambia. Il motore della videochiamata lo adottava già da solo — per
  //  questo il video continuava a funzionare — ma questa pagina restava agganciata
  //  al codice scritto nel link, cioè a un canale morto: niente media, niente
  //  scorrimento, niente link. Ora segue il codice adottato.
  const isViewer = !!watch;
  const guestCode = useGuestChannel(isViewer ? watch : null);
  const sessionId = isViewer ? (guestCode || watch) : liveId;
  useLiveNav(!!liveId && !isViewer, watch);
  const speaking = useSpeaking();

  const [current, setCurrent] = useState("");
  const [links, setLinks] = useState<Lnk[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [localMute, setLocalMute] = useState(false);   // audio spento SOLO per me (il cliente sente)
  // Audio verso il CLIENTE, deciso dal presentatore: indipendente dal proprio.
  // Viaggia con ogni aggiornamento di stato, così vale anche per chi entra dopo.
  const [guestMute, setGuestMute] = useState(false);
  const guestMuteRef = useRef(false);
  guestMuteRef.current = guestMute;
  const [needTap, setNeedTap] = useState(isViewer);     // il cliente tocca 1 volta per l'audio
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const curRef = useRef(""); curRef.current = current;
  const ytHostRef = useRef<HTMLDivElement | null>(null);
  const ytRef = useRef<YTPlayer | null>(null);
  // ── IL SITO PASSA DAL NOSTRO SERVER ───────────────────────────────────────
  //  Servito dal nostro dominio, il sito smette di essere "di un altro": la
  //  cornice diventa misurabile e pilotabile, quindi lo scorrimento si può
  //  rispecchiare come si fa con le slide. Il cliente resta libero di scorrere
  //  per conto suo: il comando arriva solo quando scorri tu.
  const siteRef = useRef<HTMLIFrameElement | null>(null);
  const proxied = (u: string) => `/api/proxy?u=${encodeURIComponent(u)}`;
  const siteEchoRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const applyingRef = useRef(false);
  const pendingRef = useRef<{ playing?: boolean; t?: number } | null>(null);

  const kind = kindOf(current);

  // firma d'ingresso della schermata
  //  ── NESSUN SUONO SENZA UN GESTO ─────────────────────────────────────────
  //   Qui la pagina suonava da sola ogni volta che veniva montata: non solo
  //   quando la aprivi tu, ma anche quando si rimontava per conto suo — una
  //   navigazione automatica, un rientro, un aggiornamento. Il suono del cambio
  //   schermata lo fa già il pulsante che premi: è quello il gesto.

  useEffect(() => { if (!isViewer) fetch("/api/presenter/links").then((r) => r.json()).then((j) => setLinks(j.links ?? [])).catch(() => {}); }, [isViewer]);
  useEffect(() => {     // ── MAI UN RICARICAMENTO COMPLETO ────────────────────────────────────
    //  Qui si usava `window.location.href`, che ricarica l'intera pagina. Lo
    //  stato della videochiamata vive in memoria: un ricaricamento la azzerava e
    //  faceva uscire ANCHE il cliente. E scattava a sorpresa, perché il
    //  riconoscimento del consulente si completa un istante dopo il montaggio.
    //  Ora si aspetta che il verdetto sia stabile e si cambia schermata senza
    //  ricaricare, così la chiamata resta viva.
    if (ready && !consultant && !isViewer) { const t = setTimeout(() => navigate({ to: "/preventivo" }), 400); return () => clearTimeout(t); } }, [ready, consultant, isViewer, navigate]);
  const gated = ready && !consultant && !isViewer;

  const send = (event: string, payload: Record<string, unknown>) => chanRef.current?.send({ type: "broadcast", event, payload });

  // ── LIMITE TECNICO, NON UN DIFETTO ────────────────────────────────────────
  //  Un sito di terzi viene mostrato dentro una cornice (iframe) di un'ALTRA
  //  origine. Il browser, per ragioni di sicurezza, vieta sia di leggere lo
  //  scorrimento di quella cornice sia di pilotarlo: nessun codice può
  //  rispecchiare lo scorrimento di un sito esterno. Restano sincronizzati i
  //  contenuti che vivono nella NOSTRA pagina (YouTube e file video: play,
  //  pausa, posizione). Per accompagnare il cliente dentro un sito esterno
  //  l'unica strada reale è la CONDIVISIONE SCHERMO della scheda.
  // ── canale contenuto (URL + stato play) ──
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase.channel(`qweb-link-${sessionId}`, { config: { broadcast: { self: false } } });
    if (isViewer) {
      ch.on("broadcast", { event: "weburl" }, ({ payload }) => { guestContentSeen(); setCurrent(String((payload as { url?: string }).url || "")); resetOwnZoom(); });
      ch.on("broadcast", { event: "playstate" }, ({ payload }) => applyPlay(payload as { playing?: boolean; t?: number; gmute?: boolean }));
      ch.on("broadcast", { event: "siteclick" }, ({ payload }) => {
        const p = (payload as { p?: number[] })?.p;
        if (!Array.isArray(p)) return;
        siteEchoRef.current = Date.now();
        siteRef.current?.contentWindow?.postMessage({ hg: "siteclickto", p }, "*");
      });
      ch.on("broadcast", { event: "sitemedia" }, ({ payload }) => {
        const d = payload as { p?: number[]; play?: boolean; t?: number; mute?: boolean };
        if (!Array.isArray(d?.p)) return;
        siteEchoRef.current = Date.now();
        siteRef.current?.contentWindow?.postMessage({ hg: "sitemediato", p: d.p, play: !!d.play, t: d.t, mute: !!d.mute }, "*");
      });
      ch.on("broadcast", { event: "sitescroll" }, ({ payload }) => {
        const r = Number((payload as { r?: number })?.r);
        if (!Number.isFinite(r)) return;
        siteEchoRef.current = Date.now();     // il rimando non deve tornare indietro
        siteRef.current?.contentWindow?.postMessage({ hg: "sitescrollto", r }, "*");
      });
      // (F) scroll sync (best-effort): mirror della pagina viewer. NB: il contenuto in
      // <iframe> è cross-origin → il suo scroll interno non è sincronizzabile.
      ch.on("broadcast", { event: "scroll" }, ({ payload }) => {
        const p = payload as { s?: number; a?: string; sub?: number };
        // ancora di contenuto (indipendente dalla risoluzione), poi frazione
        if (p.a) {
          const target = applyAnchor(null, { a: p.a, sub: Number(p.sub) || 0 });
          if (target != null) return;
        }
        applyRatio(null, Number(p.s) || 0);
      });
      ch.subscribe((s) => { if (s === "SUBSCRIBED") ch.send({ type: "broadcast", event: "webhello", payload: {} }); });
    } else {
      ch.on("broadcast", { event: "webhello" }, () => { send("weburl", { url: curRef.current }); sendPlay(); });
      ch.subscribe();
    }
    chanRef.current = ch;
    return () => { supabase.removeChannel(ch); chanRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isViewer]);

  // ── posizione/stato play attuale (host) ──
  const nowState = (): { playing: boolean; t: number } => {
    const k = kindOf(curRef.current);
    if (k === "youtube" && ytRef.current) { const st = ytRef.current.getPlayerState(); return { playing: st === 1, t: ytRef.current.getCurrentTime() || 0 }; }
    const v = videoRef.current; if (v) return { playing: !v.paused, t: v.currentTime || 0 };
    return { playing: false, t: 0 };
  };
  const sendPlay = () => { if (!isViewer) send("playstate", { ...nowState(), gmute: guestMuteRef.current }); };

  useEffect(() => {
    if (isViewer || !liveId) return;
    const iv = setInterval(() => { const s = nowState(); if (s.playing) send("playstate", { ...s, gmute: guestMuteRef.current }); }, 3000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewer, liveId, current]);

  // (F) host: trasmette lo scroll della pagina (throttle ~50ms) → mirror sul guest
  useEffect(() => {
    if (isViewer || !sessionId) return;
    let last = 0, raf = 0;
    const emit = () => {
      last = Date.now();
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const s = window.scrollY / max;
      const a = readAnchor(null);
      logOut("web", a, null);
      send("scroll", { s, a: a?.a, sub: a?.sub });
    };
    const onScroll = () => { const now = Date.now(); if (now - last < 50) { cancelAnimationFrame(raf); raf = requestAnimationFrame(emit); return; } emit(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewer, sessionId]);

  // ── applica stato play (viewer) ──
  const applyPlay = (s: { playing?: boolean; t?: number; gmute?: boolean }) => {
    pendingRef.current = s;
    const k = kindOf(curRef.current);
    const playing = !!s.playing;
    // il presentatore decide se il cliente deve sentire questo video
    const gm = s.gmute === true;
    if ("gmute" in s) setGuestMute(gm);
    const t = (Number(s.t) || 0) + (playing ? 0.4 : 0);
    if (k === "youtube" && ytRef.current) {
      applyingRef.current = true;
      const cur = ytRef.current.getCurrentTime() || 0;
      if (Math.abs(cur - t) > 1.5) ytRef.current.seekTo(t, true);
      if (gm) ytRef.current.mute(); else { ytRef.current.unMute?.(); setNeedTap(false); }
      if (playing) ytRef.current.playVideo(); else ytRef.current.pauseVideo();
      setTimeout(() => { applyingRef.current = false; }, 200);
      return;
    }
    const v = videoRef.current; if (!v) return;
    // ── PERCHÉ RIATTIVANDO L'AUDIO RESTAVA MUTO ─────────────────────────────
    //  La riattivazione era subordinata a `needTap`, che sull'ospite parte
    //  SEMPRE a true (nessun tocco ancora avvenuto): la condizione non era mai
    //  soddisfatta e il video restava muto per sempre. Ora si prova davvero a
    //  togliere il muto; se il browser rifiuta, il video prosegue muto e ricompare
    //  il pulsante per l'audio.
    if (gm) { v.muted = true; }
    else {
      v.muted = false;
      v.play().then(() => setNeedTap(false)).catch(() => { v.muted = true; setNeedTap(true); });
    }
    applyingRef.current = true;
    if (Math.abs(v.currentTime - t) > 1.2) { try { v.currentTime = t; } catch { /* not ready */ } }
    if (playing && v.paused) v.play().catch(() => {});
    if (!playing && !v.paused) v.pause();
    setTimeout(() => { applyingRef.current = false; }, 150);
  };

  // ── SCORRIMENTO DEL SITO: dal ponte al cliente ────────────────────────────
  useEffect(() => {
    if (isViewer) return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { hg?: string; r?: number; p?: number[]; play?: boolean; t?: number } | null;
      if (!d) return;
      if (Date.now() - siteEchoRef.current < 250) return;   // non rimbalzare ciò che è appena arrivato
      if (d.hg === "sitescroll" && typeof d.r === "number") { send("sitescroll", { r: d.r }); return; }
      // INTERAZIONI: un clic o un video avviato dentro il sito accade anche da lui
      if (d.hg === "siteclick" && d.p) { send("siteclick", { p: d.p }); return; }
      if (d.hg === "sitemedia" && d.p) { send("sitemedia", { p: d.p, play: !!d.play, t: d.t, mute: guestMuteRef.current }); return; }
      // il video dentro il sito è partito muto perché il browser ha rifiutato
      // l'audio: si chiede il tocco, e al tocco si riattiva DENTRO la cornice
      if (d.hg === "siteneedtap" && isViewer) { setNeedTap(true); }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewer, sessionId]);

  // ── player YouTube (host e viewer) ──
  useEffect(() => {
    if (kind !== "youtube" || !ytHostRef.current) { ytRef.current?.destroy?.(); ytRef.current = null; return; }
    const id = youtubeId(current)!;
    let player: YTPlayer | null = null;
    loadYT().then((YT) => {
      player = new YT.Player(ytHostRef.current as HTMLDivElement, {
        videoId: id,
        playerVars: { autoplay: isViewer ? 1 : 0, rel: 0, modestbranding: 1, controls: isViewer ? 0 : 1, playsinline: 1, mute: isViewer ? 1 : 0 },
        events: {
          onReady: () => {
            ytRef.current = player;
            if (isViewer) { player!.mute(); if (pendingRef.current) applyPlay(pendingRef.current); }
            else if (localMute) player!.mute();
          },
          onStateChange: (e: { data: number }) => {
            if (isViewer || applyingRef.current) return;
            if (e.data === 1 || e.data === 2) send("playstate", { playing: e.data === 1, t: player!.getCurrentTime() });
          },
        },
      });
    }).catch(() => {});
    return () => {
      // ── PERCHÉ IL PRIMO CAMBIO DI LINK DAVA ERRORE ────────────────────────
      //  Il lettore YouTube costruisce i propri nodi DENTRO il contenitore, ma
      //  non è React a gestirli. Smontandolo mentre React stava già sostituendo
      //  quel contenitore, la rimozione falliva ("nodo non trovato") e l'errore
      //  arrivava fino alla schermata. Al secondo clic il lettore non c'era più,
      //  quindi funzionava: da qui il "la prima volta no, la seconda sì".
      //  Passando a Preventivo o Slide accadeva lo stesso, e sul dispositivo del
      //  cliente quell'errore faceva ripartire la pagina: sembrava che si
      //  scollegasse dalla chiamata.
      //  Ora lo smontaggio è protetto e il contenitore viene svuotato a mano.
      try { player?.destroy?.(); } catch { /* nodo già rimosso: nessun problema */ }
      try { const h = ytHostRef.current; if (h) h.replaceChildren(); } catch { /* */ }
      ytRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, isViewer]);

  // ── AUTO-DUCK: quando il presentatore parla, abbassa il volume del video ──
  useEffect(() => {
    const factor = speaking ? DUCK_FACTOR : 1;
    // host: se ha silenziato "solo per me" resta muto
    const hostBase = localMute ? 0 : 1;
    const base = isViewer ? (needTap ? 0 : 1) : hostBase;
    const vol = base * factor;
    if (kind === "youtube" && ytRef.current) { try { ytRef.current.setVolume(Math.round(vol * 100)); if (vol === 0) ytRef.current.mute(); else ytRef.current.unMute(); } catch { /* */ } }
    if (videoRef.current) { videoRef.current.volume = vol; videoRef.current.muted = vol === 0; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speaking, localMute, needTap, current]);

  const show = (url: string) => { const u = url.trim(); setCurrent(u); setPanelOpen(false); setTimeout(() => send("weburl", { url: u }), 60); };
  const addLink = async () => {
    let u = urlInput.trim(); if (!u) return;
    if (!/^https?:\/\//i.test(u) && !youtubeId(u)) u = "https://" + u;
    const j = await (await fetch("/api/presenter/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: u }) })).json();
    setLinks(j.links ?? []); setUrlInput(""); show(u);
  };
  const del = async (url: string) => { const j = await (await fetch(`/api/presenter/links?url=${encodeURIComponent(url)}`, { method: "DELETE" })).json(); setLinks(j.links ?? []); };

  const enterAudio = () => {
    setNeedTap(false);
    if (kind === "youtube" && ytRef.current) { ytRef.current.unMute(); ytRef.current.setVolume(100); ytRef.current.playVideo(); }
    if (videoRef.current) { videoRef.current.muted = false; videoRef.current.volume = 1; videoRef.current.play().catch(() => {}); }
    send("webhello", {});
  };

  const embedYt = current && kind === "youtube";

  // ── TURN settings (solo host) ──
  const [turnForm, setTurnForm] = useState({ cfKeyId: "", cfApiToken: "", url: "", username: "", credential: "" });
  const [turnOpen, setTurnOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  // se apro /web e non sto trasmettendo nulla → apri subito i comandi (si chiudono al "Mostra")
  useEffect(() => { if (!isViewer && !curRef.current) setPanelOpen(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const [hasTurn, setHasTurn] = useState(false);
  useEffect(() => { if (!isViewer) fetch("/api/public/turn").then((r) => r.json()).then((j) => setHasTurn(!!j.hasTurn)).catch(() => {}); }, [isViewer]);
  const saveTurn = async () => {
    await fetch("/api/public/turn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(turnForm) });
    const j = await (await fetch("/api/public/turn")).json(); setHasTurn(!!j.hasTurn);
  };

  // ════════════ RENDER ════════════
  if (isViewer) {
    return (
      <div className="bg-brandfill flex h-screen flex-col">
        <div className="flex items-center justify-center gap-2 bg-brand px-4 py-1.5 text-center text-xs font-semibold text-white">
          <Radio className="h-3.5 w-3.5 animate-pulse" /> Diretta — in tempo reale
        </div>
        {/* ── PERCHÉ PASSANDO DA VIDEO A SITO USCIVA UN ERRORE ────────────────
            Il messaggio "The object can not be found here" è l'errore che il
            browser restituisce quando si prova a rimuovere un nodo che non
            risulta più figlio del suo contenitore. Qui i tre casi (YouTube,
            file video, sito) venivano scambiati fra loro DENTRO lo stesso
            contenitore: il lettore YouTube costruisce i propri nodi da sé,
            fuori dal controllo di React, e al cambio di contenuto React
            tentava di rimuovere nodi che quel lettore aveva già sostituito.
            Con una chiave distinta per ramo l'intero sottoalbero viene
            sostituito in blocco: non resta nulla da rattoppare. */}
        {embedYt ? (
          <div key="yt" className="relative flex-1">
            <div ref={ytHostRef} className="h-full w-full" />
            {needTap && <button onClick={enterAudio} className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 text-white"><Volume2 className="h-10 w-10 text-brand" /><span className="text-lg font-semibold">Tocca per l'audio</span></button>}
          </div>
        ) : kind === "video" ? (
          <div key="vid" className="relative flex-1">
            <video ref={videoRef} src={current} autoPlay muted playsInline data-keepmuted="1" onLoadedData={() => applyPlay(pendingRef.current || {})} className="h-full w-full object-contain" style={{ pointerEvents: "none" }} />
            {needTap && <button onClick={enterAudio} className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 text-white"><Volume2 className="h-10 w-10 text-brand" /><span className="text-lg font-semibold">Tocca per l'audio</span></button>}
          </div>
        ) : current ? (
          <iframe key={`site-${current}`} ref={siteRef} src={proxied(current)} title="live" className="flex-1 w-full border-0" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
        ) : (
          <div key="wait" className="flex flex-1 items-center justify-center text-white/50">In attesa del presentatore…</div>
        )}
        <Toaster />
      </div>
    );
  }

  // Presentatore
  if (gated) return <div className="bg-blueprint min-h-screen" />;
  return (
    <div className="bg-blueprint min-h-screen text-white">
      <PresenterBar page="web" />
      <main className="mx-auto w-full px-3 py-3">
        {/* Pulsante per aprire i comandi (l'anteprima resta massimizzata) */}
        <button onClick={() => setPanelOpen(true)} className="fixed bottom-16 right-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/20 px-3.5 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur hover:bg-brand/30">
          <Settings className="h-4 w-4" /> Comandi
        </button>
        <div className="mb-2 flex h-[calc(100vh-8rem)] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-brandfill">
          {embedYt ? (
            <div key="yt" ref={ytHostRef} className="h-full w-full" />
          ) : kind === "video" ? (
            <video key="vid" ref={videoRef} src={current} controls playsInline muted={localMute} data-keepmuted="1"
              onPlay={sendPlay} onPause={sendPlay} onSeeked={sendPlay} className="h-full w-full object-contain" />
          ) : current ? (
            <iframe key={`site-${current}`} ref={siteRef} src={proxied(current)} title="preview" className="h-full w-full border-0" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
          ) : (
            <div className="flex items-center justify-center gap-2 text-white/40"><Globe className="h-6 w-6" /> Incolla un link o avvia la videochiamata dalla barra in alto</div>
          )}
        </div>

        {(embedYt || kind === "video") && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand/25 bg-brand/[0.06] px-3 py-2 text-xs text-white/70">
            <Radio className="h-4 w-4 text-brand" /> <span>Play, pausa e avanzamento sono <b className="text-white">sincronizzati</b> col cliente. Quando parli, il volume si abbassa da solo.</span>
            <button onClick={() => { const n = !guestMute; setGuestMute(n); guestMuteRef.current = n; send("playstate", { ...nowState(), gmute: n }); }}
              className={`ml-auto inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-medium ${guestMute ? "border-amber-400/60 bg-amber-500/20 text-amber-200" : "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"}`}>
              {guestMute ? <><VolumeX className="h-4 w-4" /> Cliente: audio MUTO</> : <><Volume2 className="h-4 w-4" /> Cliente: audio attivo</>}
            </button>
            <button onClick={() => setLocalMute((m) => !m)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 font-medium text-white/80 hover:bg-white/10">
              {localMute ? <><VolumeX className="h-4 w-4" /> Audio spento per me</> : <><Volume2 className="h-4 w-4" /> Silenzia solo per me</>}
            </button>
          </div>
        )}

        {panelOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center" onClick={() => setPanelOpen(false)}>
        <div className="grid max-h-[85vh] w-full max-w-3xl gap-4 overflow-y-auto rounded-2xl border border-white/10 bg-[#081226] p-4 lg:grid-cols-2" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setPanelOpen(false)} className="absolute right-5 top-5 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs">Chiudi ✕</button>
          <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="mb-3 text-sm font-semibold">Link salvati</h2>
            {links.length === 0 ? (
              <p className="text-sm text-white/45">Nessun link. Aggiungine uno a destra.</p>
            ) : (
              <div className="space-y-2">
                {links.map((l) => {
                  const yt = kindOf(l.url) === "youtube";
                  return (
                    <div key={l.url} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${current === l.url ? "border-brand bg-brand/10" : "border-white/10 bg-white/[0.02]"}`}>
                      {yt ? <Youtube className="h-4 w-4 flex-shrink-0 text-red-400" /> : <Globe className="h-4 w-4 flex-shrink-0 text-brand" />}
                      <span className="min-w-0 flex-1 truncate text-sm">{l.url}</span>
                      <button onClick={() => show(l.url)} className="inline-flex items-center gap-1 rounded-md border border-brand bg-brand/10 px-2.5 py-1 text-xs font-medium hover:bg-brand/20"><Play className="h-3 w-3" /> Mostra</button>
                      <button onClick={() => del(l.url)} className="rounded-md border border-white/10 p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="mb-3 text-sm font-semibold">Trasmetti un link</h2>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLink()}
                  placeholder="Incolla URL (YouTube, sito…)"
                  className="w-full rounded-lg border border-white/20 bg-white/[0.06] py-2.5 pl-8 pr-3 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none" />
              </div>
              <button onClick={addLink} className="rounded-lg border border-brand bg-brand/10 px-3 text-sm font-medium hover:bg-brand/20">Mostra</button>
            </div>
            <p className="mt-2 text-[11px] text-white/40">YouTube: play/pausa/seek sincronizzati. Alcuni siti bloccano l'incorporamento.</p>

            <div className="mt-4 border-t border-white/10 pt-4">
              <button onClick={() => setTurnOpen((v) => !v)} className={`inline-flex items-center gap-1.5 text-[11px] ${hasTurn ? "text-emerald-400" : "text-amber-400"}`}>
                <Settings className="h-3.5 w-3.5" /> {hasTurn ? "Server TURN attivo ✓ (modifica)" : "⚠ Configura server TURN (per la videochiamata)"}
              </button>
              {turnOpen && (
                <div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[11px] font-semibold text-white/70">Cloudflare TURN (gratis 1TB/mese)</p>
                  <p className="text-[11px] leading-relaxed text-white/45">Dashboard Cloudflare → <b>Realtime</b> → <b>TURN</b> → <b>Create</b>. Incolla <b>Turn Token ID</b> e <b>API Token</b>:</p>
                  <input value={turnForm.cfKeyId} onChange={(e) => setTurnForm({ ...turnForm, cfKeyId: e.target.value })} placeholder="Turn Token ID" className="w-full rounded border border-white/15 bg-white/5 px-2 py-1.5 text-xs" />
                  <input value={turnForm.cfApiToken} onChange={(e) => setTurnForm({ ...turnForm, cfApiToken: e.target.value })} placeholder="API Token" className="w-full rounded border border-white/15 bg-white/5 px-2 py-1.5 text-xs" />
                  <button onClick={saveTurn} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white">Salva e attiva TURN</button>
                </div>
              )}
            </div>
          </section>
        </div>
        </div>
        )}
      </main>
      <Toaster />
    </div>
  );
}
