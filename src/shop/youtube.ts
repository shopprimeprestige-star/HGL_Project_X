// Caricatore dell'IFrame Player API di YouTube (una sola volta).
// Permette di controllare play/pausa/seek/mute e leggere lo stato per la diretta.
type YTNS = { Player: new (el: HTMLElement | string, opts: Record<string, unknown>) => YTPlayer };
export interface YTPlayer {
  playVideo(): void; pauseVideo(): void; seekTo(s: number, allow?: boolean): void;
  getCurrentTime(): number; getPlayerState(): number; mute(): void; unMute(): void;
  setVolume(v: number): void; destroy(): void; loadVideoById(id: string): void;
}
declare global { interface Window { YT?: YTNS; onYouTubeIframeAPIReady?: () => void } }

let loading: Promise<YTNS> | null = null;
export function loadYT(): Promise<YTNS> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise<YTNS>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); if (window.YT) resolve(window.YT); };
    if (!document.getElementById("yt-iframe-api")) {
      const s = document.createElement("script");
      s.id = "yt-iframe-api"; s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  });
  return loading;
}

/** Estrae l'ID video da un URL YouTube, o null. */
export function youtubeId(raw: string): string | null {
  const m = raw.match(/(?:youtube\.com\/(?:watch\?v=|live\/|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}
