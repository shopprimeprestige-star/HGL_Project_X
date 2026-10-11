/**
 * Premium Feedback System — vibrazione tattile + suoni audio professionali.
 * v3 — ASMR Mech-Drop click bus: pochi alti, molti bassi, transient veloce.
 */

import { useEffect } from "react";

/* ============================================================
   HAPTIC (vibration)
   ============================================================ */

type HapticPattern = number | number[];

const HAPTIC_PATTERNS = {
  tap: 8,
  select: 12,
  thermometer: 15,
  thermometerHigh: 22,
  date: 10,
  time: 20,
  progress: 6,
  success: [20, 50, 30] as number[],
  error: [30, 40, 30] as number[],
  snap: 5,
  heartbeat: [12, 90, 18] as number[],
  tick: 4,
} as const;

export type HapticKind = keyof typeof HAPTIC_PATTERNS;

function isTouchDevice(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

function canVibrate(): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.vibrate !== "function") return false;
  if (!isTouchDevice()) return false;
  return true;
}

function vibrate(kind: HapticKind | HapticPattern): void {
  try {
    if (!canVibrate()) return;
    const pattern: HapticPattern =
      typeof kind === "string" ? HAPTIC_PATTERNS[kind] : kind;
    navigator.vibrate(pattern as number | number[]);
  } catch {
    /* ignore */
  }
}

/* ============================================================
   AUDIO — WebAudio premium tones
   ============================================================ */

type SoundKind =
  | "tap"
  | "calendarPick"
  | "timePick"
  | "portatore"
  | "thermometer"
  | "urgenza"
  | "progress"
  | "success"
  | "confirm"
  | "achievement"
  | "error";

let _ctx: AudioContext | null = null;
let _master: GainNode | null = null;
let _bus: GainNode | null = null;
let _wetGain: GainNode | null = null;
let _audioUnlocked = false;

/* ---------- Audio profile (volume + wet mix configurabili) ---------- */
type AudioMode = "normal" | "low" | "silent";

const AUDIO_PROFILE = {
  /** master volume globale (0..1). Più basso = più discreto */
  master: 0.26,
  /** wet del riverbero (0.03..0.06 raccomandato) */
  wet: 0.035,
  /** moltiplicatore globale applicato a ogni voce (riduce dinamica) */
  voiceScale: 0.55,
  /** modalità: normal | low (auto su Safari/iOS) | silent */
  mode: "normal" as AudioMode,
};

function detectMode(): AudioMode {
  if (typeof window === "undefined") return "normal";
  // Permetti override via localStorage / window flag
  try {
    const ls = window.localStorage?.getItem("haptic.mode");
    if (ls === "silent" || ls === "low" || ls === "normal") return ls;
  } catch { /* ignore */ }
  const w = window as unknown as { __HAPTIC_MODE__?: AudioMode };
  if (w.__HAPTIC_MODE__) return w.__HAPTIC_MODE__;
  // Auto-low su Safari iOS (più "rumoroso" sui transient)
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  if (isIOS || isSafari) return "low";
  return "normal";
}

function applyMode(mode: AudioMode) {
  AUDIO_PROFILE.mode = mode;
  if (mode === "silent") {
    AUDIO_PROFILE.master = 0;
    AUDIO_PROFILE.wet = 0;
    AUDIO_PROFILE.voiceScale = 0;
  } else if (mode === "low") {
    AUDIO_PROFILE.master = 0.24;
    AUDIO_PROFILE.wet = 0.032;
    AUDIO_PROFILE.voiceScale = 0.55;
  } else {
    AUDIO_PROFILE.master = 0.34;
    AUDIO_PROFILE.wet = 0.045;
    AUDIO_PROFILE.voiceScale = 0.7;
  }
}

/** API pubblica per cambiare modalità audio runtime */
export function setAudioMode(mode: AudioMode): void {
  applyMode(mode);
  try { window.localStorage?.setItem("haptic.mode", mode); } catch { /* ignore */ }
  if (_master) _master.gain.value = AUDIO_PROFILE.master;
  if (_wetGain) _wetGain.gain.value = AUDIO_PROFILE.wet;
}

/** API pubblica per regolare il wet del convolver (0.03..0.06 raccomandato).
 *  Debounced (60ms) per evitare ramping costanti durante cambi rapidi del funnel. */
let _wetDebounceTimer: ReturnType<typeof setTimeout> | null = null;
export function setReverbWet(wet: number): void {
  const clamped = Math.max(0, Math.min(0.06, wet));
  AUDIO_PROFILE.wet = clamped;
  if (_wetDebounceTimer) clearTimeout(_wetDebounceTimer);
  _wetDebounceTimer = setTimeout(() => {
    if (_wetGain) {
      try {
        const ctx = getCtx();
        const now = ctx?.currentTime ?? 0;
        // Linear ramp morbido <300ms per evitare click
        _wetGain.gain.cancelScheduledValues(now);
        _wetGain.gain.linearRampToValueAtTime(clamped, now + 0.08);
      } catch {
        _wetGain.gain.value = clamped;
      }
    }
  }, 60);
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!_ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      _ctx = new Ctor();
      // Profilo automatico al primo bootstrap
      applyMode(detectMode());

      // ===== ASMR Click Bus v5 — ultra-discreto =====
      // Volume globale ~0.26, dinamica ridotta del 45%, riverbero ~0.035 wet.
      _master = _ctx.createGain();
      _master.gain.value = AUDIO_PROFILE.master;
      const comp = _ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 22;
      comp.ratio.value = 14;
      comp.attack.value = 0.002;
      comp.release.value = 0.18;
      const lp = _ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 680;
      lp.Q.value = 0.7;
      const hp = _ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 42;
      hp.Q.value = 0.3;
      const ls = _ctx.createBiquadFilter();
      ls.type = "lowshelf";
      ls.frequency.value = 280;
      ls.gain.value = 10;
      const pk = _ctx.createBiquadFilter();
      pk.type = "peaking";
      pk.frequency.value = 110;
      pk.Q.value = 1.4;
      pk.gain.value = 6;
      const notch = _ctx.createBiquadFilter();
      notch.type = "peaking";
      notch.frequency.value = 1800;
      notch.Q.value = 1.6;
      notch.gain.value = -12;
      _bus = _ctx.createGain();
      _bus.gain.value = AUDIO_PROFILE.voiceScale;

      // --- Reverb impercettibile (impulso 140ms, decay rapido) ---
      const convolver = _ctx.createConvolver();
      const sr = _ctx.sampleRate;
      const irLen = Math.floor(sr * 0.14);
      const ir = _ctx.createBuffer(2, irLen, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < irLen; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.6);
        }
      }
      convolver.buffer = ir;
      _wetGain = _ctx.createGain();
      _wetGain.gain.value = AUDIO_PROFILE.wet;
      const dry = _ctx.createGain();
      dry.gain.value = 1;

      _bus.connect(hp);
      hp.connect(ls);
      ls.connect(pk);
      pk.connect(notch);
      notch.connect(lp);
      lp.connect(dry);
      lp.connect(convolver);
      convolver.connect(_wetGain);
      dry.connect(comp);
      _wetGain.connect(comp);
      comp.connect(_master);
      _master.connect(_ctx.destination);
    }
    if (_ctx.state === "suspended") void _ctx.resume();
    return _ctx;
  } catch {
    return null;
  }
}

function unlockAudio(): void {
  if (_audioUnlocked) return;
  const ctx = getCtx();
  if (!ctx) return;
  _audioUnlocked = true;
}

if (typeof window !== "undefined") {
  const onFirst = () => {
    unlockAudio();
    window.removeEventListener("pointerdown", onFirst);
    window.removeEventListener("touchstart", onFirst);
    window.removeEventListener("keydown", onFirst);
  };
  window.addEventListener("pointerdown", onFirst, { once: true, passive: true });
  window.addEventListener("touchstart", onFirst, { once: true, passive: true });
  window.addEventListener("keydown", onFirst, { once: true });
}

interface ToneOptions {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  release?: number;
  glideTo?: number;
  detune?: number;
}

function playTone(t: number, opts: ToneOptions) {
  const ctx = getCtx();
  if (!ctx || !_bus) return;
  const {
    freq, dur, type = "sine", gain = 0.12,
    attack = 0.014, release = 0.22, glideTo, detune = 0,
  } = opts;

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (typeof glideTo === "number") {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t + dur);
  }
  if (detune) osc.detune.setValueAtTime(detune, t);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(Math.max(0.0002, gain), t + attack);
  g.gain.setValueAtTime(Math.max(0.0002, gain), t + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);

  osc.connect(g);
  g.connect(_bus);
  osc.start(t);
  osc.stop(t + dur + release + 0.05);
}

function noiseClick(
  t: number,
  opts?: { gain?: number; dur?: number; release?: number; centerHz?: number; q?: number },
) {
  const ctx = getCtx();
  if (!ctx || !_bus) return;
  const gain = opts?.gain ?? 0.18;
  const dur = opts?.dur ?? 0.012;
  const release = opts?.release ?? 0.05;
  const centerHz = opts?.centerHz ?? 220;
  const q = opts?.q ?? 1.5;

  const len = Math.max(64, Math.floor((dur + release + 0.02) * ctx.sampleRate));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  // Pink-ish noise: spettro più carico nei bassi che bianco
  let lastOut = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.04 * white) / 1.04;
    data[i] = lastOut * 6;
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = centerHz;
  bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
  src.connect(bp);
  bp.connect(g);
  g.connect(_bus);
  src.start(t);
  src.stop(t + dur + release + 0.02);
}

function playSound(kind: SoundKind): void {
  const ctx = getCtx();
  if (!ctx || !_bus) return;
  const t = ctx.currentTime + 0.004;

  // === ASMR Mech-Drop Click v3 ===
  // transient mech (snap brevissimo) + body sine glissato + sub-bass parallelo.
  // Durata totale ~110-150ms. Pochi alti, molti bassi, sempre uguale.
  const mechDrop = (
    fund: number,
    opts?: {
      gain?: number;
      bodyDur?: number;
      release?: number;
      transient?: number;
      transientHz?: number;
      sub?: boolean;
      brightness?: number;
    },
  ) => {
    const gain = opts?.gain ?? 0.4;
    const bodyDur = opts?.bodyDur ?? 0.022;
    const release = opts?.release ?? 0.11;
    const trGain = opts?.transient ?? 0.18;
    const trHz = opts?.transientHz ?? 200;
    const brightness = opts?.brightness ?? 0.35;

    noiseClick(t, {
      gain: trGain,
      dur: 0.003,
      release: 0.018,
      centerHz: trHz,
      q: 2,
    });

    if (brightness > 0) {
      // "Snap" secondario: definisce il click ma resta sotto il notch a 1.8kHz
      noiseClick(t + 0.0008, {
        gain: trGain * 0.55 * brightness,
        dur: 0.0018,
        release: 0.012,
        centerHz: 520,
        q: 4,
      });
    }

    playTone(t + 0.0015, {
      freq: fund,
      glideTo: fund * 0.45,
      dur: bodyDur,
      type: "sine",
      gain,
      attack: 0.0015,
      release,
    });

    if (opts?.sub !== false) {
      playTone(t + 0.002, {
        freq: fund * 0.5,
        glideTo: fund * 0.25,
        dur: bodyDur + 0.012,
        type: "sine",
        gain: gain * 1.1,
        attack: 0.002,
        release: release * 1.25,
      });
    }
  };

  switch (kind) {
    case "tap":
      mechDrop(280, { gain: 0.32, transient: 0.14, transientHz: 220, brightness: 0.25 });
      break;
    case "calendarPick":
      // Doppio click ASMR: primo tap brillante + secondo tap più grave a 70ms
      mechDrop(360, { gain: 0.46, transient: 0.22, transientHz: 250, release: 0.12, brightness: 0.5 });
      setTimeout(() => {
        const ctx2 = getCtx();
        if (!ctx2 || !_bus) return;
        const t2 = ctx2.currentTime + 0.002;
        noiseClick(t2, { gain: 0.18, dur: 0.0025, release: 0.016, centerHz: 220, q: 2 });
        playTone(t2 + 0.0015, { freq: 280, glideTo: 140, dur: 0.022, type: "sine", gain: 0.42, attack: 0.0015, release: 0.12 });
        playTone(t2 + 0.002, { freq: 140, glideTo: 70, dur: 0.028, type: "sine", gain: 0.4, attack: 0.002, release: 0.16 });
      }, 70);
      break;
    case "timePick":
      // Doppio click ASMR: primo tap medio + secondo tap leggermente più alto a 70ms
      mechDrop(310, { gain: 0.46, transient: 0.22, transientHz: 230, release: 0.12, brightness: 0.45 });
      setTimeout(() => {
        const ctx2 = getCtx();
        if (!ctx2 || !_bus) return;
        const t2 = ctx2.currentTime + 0.002;
        noiseClick(t2, { gain: 0.18, dur: 0.0025, release: 0.016, centerHz: 240, q: 2 });
        playTone(t2 + 0.0015, { freq: 340, glideTo: 170, dur: 0.022, type: "sine", gain: 0.42, attack: 0.0015, release: 0.12 });
        playTone(t2 + 0.002, { freq: 170, glideTo: 85, dur: 0.028, type: "sine", gain: 0.4, attack: 0.002, release: 0.16 });
      }, 70);
      break;
    case "portatore":
      mechDrop(240, { gain: 0.44, transient: 0.22, transientHz: 200, release: 0.16, bodyDur: 0.026, brightness: 0.3 });
      break;
    case "thermometer":
      mechDrop(360, { gain: 0.4, transient: 0.18, transientHz: 250, release: 0.1, bodyDur: 0.02, brightness: 0.5 });
      break;
    case "urgenza":
      mechDrop(290, { gain: 0.4, transient: 0.18, transientHz: 230, release: 0.12, brightness: 0.35 });
      break;
    case "progress":
      mechDrop(380, { gain: 0.28, transient: 0.12, transientHz: 280, release: 0.08, sub: false, bodyDur: 0.014, brightness: 0.3 });
      break;
    case "success": {
      mechDrop(360, { gain: 0.42, transient: 0.2, transientHz: 240, release: 0.12, brightness: 0.5 });
      setTimeout(() => {
        const ctx2 = getCtx();
        if (!ctx2 || !_bus) return;
        const t2 = ctx2.currentTime + 0.002;
        noiseClick(t2, { gain: 0.18, dur: 0.0028, release: 0.018, centerHz: 240, q: 2 });
        playTone(t2 + 0.0015, { freq: 440, glideTo: 200, dur: 0.026, type: "sine", gain: 0.42, attack: 0.0015, release: 0.16 });
        playTone(t2 + 0.002, { freq: 220, glideTo: 100, dur: 0.034, type: "sine", gain: 0.4, attack: 0.002, release: 0.22 });
      }, 105);
      break;
    }
    case "confirm": {
      // ASMR "page-confirmed" cue: profondo, caldo, due gocce di sub-bass
      // a distanza ravvicinata + un body sine lungo. Pochi alti per davvero,
      // bassi pieni come una conferma fisica. Usato solo sulla thank-you.
      mechDrop(220, { gain: 0.46, transient: 0.18, transientHz: 180, release: 0.2, bodyDur: 0.03, brightness: 0.18 });
      setTimeout(() => {
        const ctx2 = getCtx();
        if (!ctx2 || !_bus) return;
        const t2 = ctx2.currentTime + 0.002;
        noiseClick(t2, { gain: 0.16, dur: 0.003, release: 0.022, centerHz: 180, q: 2 });
        playTone(t2 + 0.002, { freq: 196, glideTo: 98, dur: 0.05, type: "sine", gain: 0.46, attack: 0.003, release: 0.32 });
        playTone(t2 + 0.0025, { freq: 98, glideTo: 49, dur: 0.06, type: "sine", gain: 0.44, attack: 0.004, release: 0.38 });
      }, 150);
      break;
    }
    case "achievement": {
      // Premium "obiettivo raggiunto" — arpeggio caldo ascendente in sub-bass,
      // due gocce dolci poi una nota lunga di chiusura. Pochi alti, molto warm.
      const ctx2 = ctx;
      const t0 = t + 0.005;
      // Goccia 1
      noiseClick(t0, { gain: 0.14, dur: 0.0028, release: 0.02, centerHz: 180, q: 2 });
      playTone(t0 + 0.0015, { freq: 261, glideTo: 130, dur: 0.04, type: "sine", gain: 0.4, attack: 0.0025, release: 0.22 });
      playTone(t0 + 0.002, { freq: 130, glideTo: 65, dur: 0.05, type: "sine", gain: 0.42, attack: 0.003, release: 0.28 });
      // Goccia 2 — quinta sopra
      const t1 = t0 + 0.13;
      noiseClick(t1, { gain: 0.13, dur: 0.0026, release: 0.02, centerHz: 200, q: 2 });
      playTone(t1 + 0.0015, { freq: 392, glideTo: 196, dur: 0.045, type: "sine", gain: 0.38, attack: 0.0025, release: 0.24 });
      playTone(t1 + 0.002, { freq: 196, glideTo: 98, dur: 0.055, type: "sine", gain: 0.4, attack: 0.003, release: 0.3 });
      // Nota di chiusura — lunga e profonda
      const t2 = t1 + 0.18;
      noiseClick(t2, { gain: 0.12, dur: 0.003, release: 0.024, centerHz: 160, q: 2 });
      playTone(t2 + 0.002, { freq: 196, glideTo: 98, dur: 0.08, type: "sine", gain: 0.44, attack: 0.004, release: 0.42 });
      playTone(t2 + 0.0025, { freq: 98, glideTo: 49, dur: 0.1, type: "sine", gain: 0.42, attack: 0.005, release: 0.5 });
      void ctx2;
      break;
    }
    case "error": {
      mechDrop(220, { gain: 0.42, transient: 0.2, transientHz: 200, release: 0.16, brightness: 0.3 });
      setTimeout(() => {
        const ctx2 = getCtx();
        if (!ctx2 || !_bus) return;
        const t2 = ctx2.currentTime + 0.002;
        noiseClick(t2, { gain: 0.18, dur: 0.0035, release: 0.022, centerHz: 180, q: 2 });
        playTone(t2 + 0.0015, { freq: 180, glideTo: 90, dur: 0.03, type: "sine", gain: 0.42, attack: 0.002, release: 0.2 });
        playTone(t2 + 0.002, { freq: 90, glideTo: 50, dur: 0.038, type: "sine", gain: 0.4, attack: 0.0025, release: 0.24 });
      }, 110);
      break;
    }
  }
}

/* ============================================================
   API pubblica unificata
   ============================================================ */

const SOUND_FOR_HAPTIC: Record<HapticKind, SoundKind | null> = {
  tap: "tap",
  select: "urgenza",
  thermometer: "thermometer",
  thermometerHigh: "thermometer",
  date: "calendarPick",
  time: "timePick",
  progress: "progress",
  success: null,
  error: "error",
  snap: null,
  heartbeat: null,
  tick: null,
};

export function haptic(kind: HapticKind | HapticPattern = "tap"): void {
  vibrate(kind);
  if (typeof kind === "string") {
    const s = SOUND_FOR_HAPTIC[kind];
    if (s) playSound(s);
  }
}

export function sound(kind: SoundKind): void {
  playSound(kind);
}

/* ============================================================
   Hooks ausiliari (scroll snap + battito)
   ============================================================ */

export function useScrollSnapHaptic(
  selector: string = "[data-haptic-snap]",
): void {
  useEffect(() => {
    if (!canVibrate()) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
    if (els.length === 0) return;
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6 && !seen.has(e.target)) {
            seen.add(e.target);
            haptic("snap");
            setTimeout(() => seen.delete(e.target), 1500);
          }
        }
      },
      { threshold: [0.6] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [selector]);
}

export function useHeartbeatHaptic(active: boolean, intervalMs: number = 1000): void {
  useEffect(() => {
    if (!active || !canVibrate()) return;
    const id = window.setInterval(() => haptic("heartbeat"), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);
}
