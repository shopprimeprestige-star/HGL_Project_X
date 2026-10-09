import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CheckCircle2,
  Loader2,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  Video,
  AlertCircle,
  Smartphone,
  CheckCheck,
  Lock,
  ShieldCheck,
  Timer,
  UserCheck,
  Sparkles,
  Mail,
  User as UserIcon,
  MapPin,
  Phone as PhoneIcon,
} from "lucide-react";
import { formatBookingPhrase } from "@/lib/date-format";
import { haptic, sound, setAudioMode, setReverbWet } from "@/hooks/use-haptic";
import {
  buildJourneySnapshot,
  captureSourceData,
  detectSource,
  eventId as makeEventId,
  fireCapi,
  firePixel,
  trackEvent,
} from "./tracking";

function scrollToEl(el: HTMLElement | null) {
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo({ top, behavior: "smooth" });
}

// Default 9:00–21:30 ogni 30 min
function buildDefaultSlots(): string[] {
  const out: string[] = [];
  for (let h = 9; h <= 21; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    if (h !== 21) out.push(`${String(h).padStart(2, "0")}:30`);
  }
  out.push("21:30");
  return Array.from(new Set(out)).sort();
}
const DEFAULT_TIME_SLOTS = buildDefaultSlots();

const URGENZA_OPTIONS = [
  { v: "subito", l: "Subito, voglio risolvere" },
  { v: "1mese", l: "Entro 1 mese" },
  { v: "convince", l: "Se mi convince, parto subito" },
  { v: "2_3mesi", l: "Tra 2–3 mesi, mi organizzo" },
  { v: "valuto", l: "Sto valutando diverse opzioni" },
] as const;

interface Props {
  variant?: "light" | "dark";
}

// Step flow: 0=Calendar+Time, 1=Portatore, 2=Disagio, 3=Urgenza, 4=Contact, 5=ThankYou
type Step = 0 | 1 | 2 | 3 | 4 | 5;

interface FormState {
  date: string;
  time: string;
  fullName: string;
  email: string;
  telefono: string;
  citta: string;
  urgenza: string;
  disagio: number;
  portatore: "si" | "no" | "";
  portatoreMotivo: string;
}

const EMPTY: FormState = {
  date: "",
  time: "",
  fullName: "",
  email: "",
  telefono: "",
  citta: "",
  urgenza: "",
  disagio: 0,
  portatore: "",
  portatoreMotivo: "",
};

// === Persistenza localStorage (TTL 2h) ===
const LS_KEY = "hgl_booking_funnel_v1";
const LS_TTL_MS = 2 * 60 * 60 * 1000;
interface PersistedState {
  step: Step;
  form: FormState;
  ts: number;
}
function loadPersisted(): PersistedState | null {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed.ts || Date.now() - parsed.ts > LS_TTL_MS) {
      window.localStorage.removeItem(LS_KEY);
      return null;
    }
    if (parsed.step === 5) return null;
    return parsed;
  } catch {
    return null;
  }
}
function savePersisted(step: Step, form: FormState) {
  try {
    if (step === 5) {
      window.localStorage.removeItem(LS_KEY);
      return;
    }
    window.localStorage.setItem(
      LS_KEY,
      JSON.stringify({ step, form, ts: Date.now() } satisfies PersistedState),
    );
  } catch {
    /* ignore quota */
  }
}
function clearPersisted() {
  try {
    window.localStorage.removeItem(LS_KEY);
  } catch { /* ignore */ }
}

function splitName(full: string): { nome: string; cognome: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 0) return { nome: "", cognome: "" };
  if (parts.length === 1) return { nome: parts[0], cognome: "" };
  return { nome: parts[0], cognome: parts.slice(1).join(" ") };
}

const ANDROID_LINK =
  "https://play.google.com/store/apps/details?id=com.google.android.apps.tachyon&pcampaignid=web_share";
const IOS_LINK = "https://apps.apple.com/us/app/google-meet/id1096918571";

const WEEKDAYS_SHORT = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"];
const MONTHS_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

export const CUSTOM_EVENTS = {
  pageView: "Visita_Landing",
  viewFunnel: "Vista_Funnel_Prenotazione",
  viewCalendario: "Vista_Calendario",
  selezionaData: "Selezionata_Data_Consulenza",
  selezionaOrario: "Selezionato_Orario_Consulenza",
  rispostaPortatore: "Risposta_Portatore_Impianto",
  rispostaDisagio: "Risposta_Livello_Disagio",
  rispostaUrgenza: "Risposta_Urgenza",
  vistaContatti: "Vista_Form_Contatti",
  leadInviato: "Lead_Prenotazione_Inviato",
} as const;

function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function BookingFunnel({ variant = "light" }: Props) {
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portatoreMotivoOpen, setPortatoreMotivoOpen] = useState(false);
  // Exit-intent popup rimosso su richiesta utente
  const funnelStartRef = useRef<number>(Date.now());
  // Hidratato → evita flicker e duplicati nel salvataggio LS
  const hydratedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef<HTMLDivElement | null>(null);

  const [timeSlots, setTimeSlots] = useState<string[]>(DEFAULT_TIME_SLOTS);
  const [blockedWeekdays, setBlockedWeekdays] = useState<Set<number>>(new Set());
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [blockedSlots, setBlockedSlots] = useState<Record<string, string[]>>({});
  const [busyByDate, setBusyByDate] = useState<Record<string, Set<string>>>({});

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);
  const [viewMonth, setViewMonth] = useState<{ y: number; m: number }>(() => ({
    y: today.getFullYear(),
    m: today.getMonth(),
  }));

  // === Hydrate da localStorage al mount + prefill da query string (Meta/TikTok lead forms) ===
  useEffect(() => {
    const persisted = loadPersisted();
    let baseForm: FormState = persisted ? persisted.form : EMPTY;
    let baseStep: Step = persisted ? persisted.step : 0;

    try {
      const qs = new URLSearchParams(window.location.search);
      const get = (...keys: string[]): string => {
        for (const k of keys) {
          const v = qs.get(k);
          if (v && v.trim()) return v.trim();
        }
        return "";
      };
      const nome = get("nome", "name", "first_name", "firstname", "full_name", "fullname");
      const cognome = get("cognome", "last_name", "lastname", "surname");
      const email = get("email", "mail", "e_mail");
      const tel = get("tel", "telefono", "phone", "phone_number", "mobile");
      const citta = get("citta", "city", "town", "address-level2");

      const fullName = baseForm.fullName ||
        [nome, cognome].filter(Boolean).join(" ").trim();

      const prefilled: FormState = {
        ...baseForm,
        fullName: fullName || baseForm.fullName,
        email: baseForm.email || email,
        telefono: baseForm.telefono || tel,
        citta: baseForm.citta || citta,
      };

      const hasAnyContact = !!(prefilled.fullName || prefilled.email || prefilled.telefono);
      // Se Meta/TikTok ha già passato i contatti e non c'è uno stato persistito avanzato,
      // salta direttamente allo step 4 — l'utente deve solo confermare.
      if (!persisted && hasAnyContact && (fullName || email || tel)) {
        // Per saltare allo step 4 servono però data/ora: se mancano, restiamo allo step 0
        // ma con i contatti già pronti per quando ci arriverà.
      }

      baseForm = prefilled;
    } catch {
      /* ignore prefill errors */
    }

    setForm(baseForm);
    setStep(baseStep);
    hydratedRef.current = true;
  }, []);

  // === Persist ad ogni cambio (dopo hydrate) ===
  useEffect(() => {
    if (!hydratedRef.current) return;
    savePersisted(step, form);
  }, [step, form]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [slotsRes, busyRes] = await Promise.all([
        supabase
          .from("funnel_settings")
          .select("time_slots,blocked_weekdays,blocked_dates,blocked_slots")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("public_leads")
          .select("data_slot,ora_slot")
          .eq("slot_released", false)
          .eq("slot_pending", false)
          .not("data_slot", "is", null)
          .not("ora_slot", "is", null),
      ]);
      if (cancelled) return;
      const settings = slotsRes.data as
        | {
            time_slots?: string[];
            blocked_weekdays?: number[];
            blocked_dates?: string[];
            blocked_slots?: Record<string, string[]>;
          }
        | null;
      if (settings?.time_slots && Array.isArray(settings.time_slots) && settings.time_slots.length > 0) {
        setTimeSlots(settings.time_slots);
      }
      if (Array.isArray(settings?.blocked_weekdays)) {
        setBlockedWeekdays(new Set(settings.blocked_weekdays));
      }
      if (Array.isArray(settings?.blocked_dates)) {
        setBlockedDates(new Set(settings.blocked_dates));
      }
      if (settings?.blocked_slots && typeof settings.blocked_slots === "object") {
        setBlockedSlots(settings.blocked_slots);
      }
      const map: Record<string, Set<string>> = {};
      for (const row of busyRes.data ?? []) {
        if (!row.data_slot || !row.ora_slot) continue;
        if (!map[row.data_slot]) map[row.data_slot] = new Set();
        map[row.data_slot].add(row.ora_slot);
      }
      setBusyByDate(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    captureSourceData();
    // Modalità "low" durante il funnel: volume e wet ridotti, riverbero impercettibile.
    try { setAudioMode("low"); } catch { /* ignore */ }
    try { setReverbWet(0.03); } catch { /* ignore */ }
    const pvId = makeEventId();
    firePixel("PageView", {}, pvId, { dedupKey: "global" });
    void fireCapi("PageView", pvId, {}, {});
    const vcId = makeEventId();
    firePixel("ViewContent", { content_name: "booking_funnel" }, vcId, {
      dedupKey: "booking_funnel",
      customName: CUSTOM_EVENTS.viewFunnel,
    });
    void fireCapi("ViewContent", vcId, {}, { content_name: "booking_funnel" });
    trackEvent("PageView", 0, { custom_event: CUSTOM_EVENTS.pageView }, { dedupKey: "global" });
    trackEvent("StepView", 0, { step_name: "calendar", custom_event: CUSTOM_EVENTS.viewCalendario }, { dedupKey: "step:0" });
    trackEvent("FunnelStep", 1, { step_name: "calendar", custom_event: CUSTOM_EVENTS.viewCalendario }, { dedupKey: "fstep:1" });
  }, []);

  // Wet del convolver scende leggermente avanzando negli step (debounced internamente).
  useEffect(() => {
    const wetByStep = [0.035, 0.032, 0.03, 0.028, 0.026, 0.04];
    try { setReverbWet(wetByStep[step] ?? 0.03); } catch { /* ignore */ }
  }, [step]);

  // Exit-intent rimosso su richiesta utente

  const isLight = variant === "light";
  // Dallo step "portatore" in poi lo sfondo del funnel diventa sempre bianco (look "scheda clinica")
  const forceWhite = step >= 1;
  // Quando il fondo è bianco (light o forzato), USA SEMPRE testi scuri.
  const lightSurface = isLight || forceWhite;
  const wrapper = lightSurface
    ? "bg-white text-ink"
    : "bg-navy-light/40 text-white border border-white/10";
  const inputCls = lightSurface
    ? "mt-1 bg-white text-ink border-ink/20 placeholder:text-ink-muted/60"
    : "mt-1 bg-white/10 text-white border-white/20 placeholder:text-white/40";
  const labelCls = lightSurface ? "text-xs text-ink" : "text-xs text-white/80";
  const eyebrow = "text-[0.65rem] tracking-[0.2em] uppercase font-semibold text-brand";
  const mutedText = lightSurface ? "text-ink-muted" : "text-white/70";

  const goNext = (next: Step) => {
    setStep(next);
    // Haptic di conferma quando la progress bar avanza
    haptic("progress");
    const stepNames = ["calendar", "portatore", "disagio", "urgenza", "contact", "thankyou"] as const;
    const customMap = [
      CUSTOM_EVENTS.viewCalendario,
      CUSTOM_EVENTS.rispostaPortatore,
      CUSTOM_EVENTS.rispostaDisagio,
      CUSTOM_EVENTS.rispostaUrgenza,
      CUSTOM_EVENTS.vistaContatti,
      CUSTOM_EVENTS.leadInviato,
    ];
    trackEvent("StepView", next, { step_name: stepNames[next], custom_event: customMap[next] }, { dedupKey: `step:${next}` });
    trackEvent(
      "FunnelStep",
      next + 1,
      { step_name: stepNames[next], custom_event: customMap[next] },
      { dedupKey: `fstep:${next + 1}` },
    );
    requestAnimationFrame(() => scrollToEl(rootRef.current));
  };

  const monthMatrix = useMemo(() => {
    const { y, m } = viewMonth;
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const firstWeekdayJs = first.getDay();
    const firstWeekdayMon = (firstWeekdayJs + 6) % 7;
    const cells: { date: Date | null; iso: string | null }[] = [];
    for (let i = 0; i < firstWeekdayMon; i++) cells.push({ date: null, iso: null });
    for (let d = 1; d <= last.getDate(); d++) {
      const dt = new Date(y, m, d);
      cells.push({ date: dt, iso: isoFromDate(dt) });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, iso: null });
    return cells;
  }, [viewMonth]);

  const isDayAvailable = (date: Date): boolean => {
    if (date < today) return false;
    if (blockedWeekdays.has(date.getDay())) return false;
    if (blockedDates.has(isoFromDate(date))) return false;
    return true;
  };

  const canGoPrevMonth = (() => {
    const { y, m } = viewMonth;
    return !(y === today.getFullYear() && m === today.getMonth());
  })();

  const handleDatePick = (date: Date) => {
    haptic("date");
    const iso = isoFromDate(date);
    setForm((f) => ({ ...f, date: iso, time: "" }));
    const id = makeEventId();
    firePixel("AddToCart", { content_name: "date_pick", value: 0 }, id, {
      dedupKey: "date_pick",
      customName: CUSTOM_EVENTS.selezionaData,
    });
    void fireCapi("AddToCart", id, {}, { content_name: "date_pick" });
    trackEvent("AddToCart", 1, { date: iso, content_name: "date_pick", event_id: id, custom_event: CUSTOM_EVENTS.selezionaData }, { dedupKey: "date_pick" });
    trackEvent("FunnelStep", 1, { step_name: "date_picked", date: iso, custom_event: CUSTOM_EVENTS.selezionaData }, { dedupKey: "fstep:1:date" });
    requestAnimationFrame(() => setTimeout(() => scrollToEl(timeRef.current), 80));
  };

  const handleTimePick = (t: string) => {
    haptic("time");
    setForm((f) => ({ ...f, time: t }));
    const id = makeEventId();
    firePixel("AddToCart", { content_name: "time_pick" }, id, {
      dedupKey: "time_pick",
      customName: CUSTOM_EVENTS.selezionaOrario,
    });
    void fireCapi("AddToCart", id, {}, { content_name: "time_pick" });
    trackEvent("AddToCart", 1, { time: t, content_name: "time_pick", event_id: id, custom_event: CUSTOM_EVENTS.selezionaOrario }, { dedupKey: "time_pick" });
    goNext(1);
  };

  const pickPortatore = (v: "si" | "no") => {
    haptic("select");
    setForm((f) => ({ ...f, portatore: v }));
    trackEvent("FunnelStep", 2, { step_name: "portatore", value: v, custom_event: CUSTOM_EVENTS.rispostaPortatore }, { dedupKey: `fstep:2:${v}` });
    if (v === "si") {
      setPortatoreMotivoOpen(true);
      return;
    }
    setTimeout(() => goNext(2), 220);
  };

  const confirmPortatoreMotivo = () => {
    setPortatoreMotivoOpen(false);
    setTimeout(() => goNext(2), 120);
  };

  const pickDisagio = (n: number) => {
    haptic(n >= 8 ? "thermometerHigh" : "thermometer");
    setForm((f) => ({ ...f, disagio: n }));
    trackEvent("FunnelStep", 3, { step_name: "disagio", value: n, custom_event: CUSTOM_EVENTS.rispostaDisagio }, { dedupKey: `fstep:3:${n}` });
    setTimeout(() => goNext(3), 220);
  };

  const pickUrgenza = (v: string) => {
    haptic("select");
    setForm((f) => ({ ...f, urgenza: v }));
    trackEvent("FunnelStep", 4, { step_name: "urgenza", value: v, custom_event: CUSTOM_EVENTS.rispostaUrgenza }, { dedupKey: `fstep:4:${v}` });
    setTimeout(() => goNext(4), 220);
  };

  const validateContacts = () => {
    // Solo nome (prima parola) e telefono sono realmente obbligatori.
    // Email, città e cognome sono facoltativi: non lo diciamo nel frontend.
    if (!form.fullName.trim()) {
      setError("Inserisci il tuo nome");
      return false;
    }
    // Email facoltativa: se inserita deve essere valida.
    const emailRaw = form.email.trim();
    if (emailRaw && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailRaw)) {
      setError("L'email inserita non è valida");
      return false;
    }
    const telDigits = form.telefono.trim().replace(/\D/g, "");
    const telOk =
      (telDigits.length >= 9 && telDigits.length <= 10) ||
      (telDigits.startsWith("39") && telDigits.length >= 11 && telDigits.length <= 12);
    if (!telOk) {
      setError("Inserisci un numero di telefono valido (es. 333 1234567)");
      return false;
    }
    setError(null);
    return true;
  };

  const submit = async () => {
    if (!validateContacts()) {
      haptic("error");
      return;
    }
    setSubmitting(true);
    setError(null);
    const source = captureSourceData();
    const journey = buildJourneySnapshot();
    const evt_id = makeEventId();
    const { nome, cognome } = splitName(form.fullName);
    const baseDisagio = form.disagio || 5;
    const finalDisagio = form.portatore === "si" ? Math.min(10, baseDisagio + 2) : baseDisagio;
    const insertPayload: Record<string, unknown> = {
      nome,
      cognome: cognome || "—",
      email: form.email.trim() || "—",
      telefono: form.telefono.trim(),
      citta: form.citta.trim() || "—",
      data_slot: form.date,
      ora_slot: form.time,
      disagio_score: finalDisagio,
      pain_points: [],
      urgenza: form.urgenza,
      portatore: form.portatore === "si" ? true : form.portatore === "no" ? false : null,
      portatore_motivo: form.portatore === "si" && form.portatoreMotivo.trim() ? form.portatoreMotivo.trim() : null,
      utm_source: source.utm_source ?? detectSource(),
      utm_medium: source.utm_medium,
      utm_campaign: source.utm_campaign,
      utm_id: source.utm_id ?? null,
      utm_content: source.utm_content ?? null,
      utm_term: source.utm_term ?? null,
      fbp: source.fbp,
      fbc: source.fbc,
      fbclid: source.fbclid ?? null,
      ttclid: source.ttclid,
      ad_id: source.ad_id ?? null,
      adset_id: source.adset_id ?? null,
      campaign_id: source.campaign_id ?? null,
      ad_name: source.ad_name ?? null,
      creative_name: source.creative_name ?? null,
      external_id: source.external_id ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      event_id: evt_id,
      touch_history: journey.touch_history as never,
      touch_count: journey.touch_count,
      first_channel: journey.first_channel,
      last_channel: journey.last_channel,
      journey_type: journey.journey_type,
      days_to_convert: journey.days_to_convert,
      hours_to_convert: journey.hours_to_convert,
    };
    const { error: err } = await supabase.from("public_leads").insert(insertPayload as never);
    setSubmitting(false);
    if (err) {
      setError("Errore invio: " + err.message);
      haptic("error");
      return;
    }
    // Cue ASMR di conferma → poi cue "achievement" premium per "obiettivo raggiunto".
    haptic("success");
    sound("confirm");
    setTimeout(() => sound("achievement"), 320);
    firePixel("Lead", { content_name: "booking_lead", value: 1, currency: "EUR" }, evt_id, {
      customName: CUSTOM_EVENTS.leadInviato,
    });
    void fireCapi(
      "Lead",
      evt_id,
      {
        email: form.email.trim(),
        phone: form.telefono.trim(),
        first_name: nome,
        last_name: cognome,
        city: form.citta.trim(),
      },
      { value: 1, currency: "EUR", content_name: "booking_lead" },
    );
    trackEvent("Lead", 6, { event_id: evt_id, custom_event: CUSTOM_EVENTS.leadInviato });
    trackEvent("FunnelStep", 6, { step_name: "lead_submitted", custom_event: CUSTOM_EVENTS.leadInviato }, { dedupKey: "fstep:6:lead" });
    clearPersisted();
    goNext(5);
  };

  const totalSteps = 5;
  const progressPct = Math.min(100, Math.round(((step + (step === 5 ? 0 : 1)) / totalSteps) * 100));
  const secondsLeft = step >= 5 ? 0 : Math.max(5, (totalSteps - step - 1) * 10 + 5);

  const bookingPhrase = useMemo(() => {
    if (!form.date || !form.time) return "";
    return formatBookingPhrase(form.date, form.time);
  }, [form.date, form.time]);

  const fullNameValid = form.fullName.trim().length >= 2;
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim());
  const telDigitsLive = form.telefono.trim().replace(/\D/g, "");
  const telefonoValid =
    (telDigitsLive.length >= 9 && telDigitsLive.length <= 10) ||
    (telDigitsLive.startsWith("39") && telDigitsLive.length >= 11 && telDigitsLive.length <= 12);

  const availableSlotsForDate = useMemo(() => {
    if (!form.date) return [] as string[];
    const blockedForDay = blockedSlots[form.date] || [];
    const busyForDay = busyByDate[form.date] || new Set<string>();
    return timeSlots.filter((t) => !blockedForDay.includes(t) && !busyForDay.has(t));
  }, [form.date, timeSlots, blockedSlots, busyByDate]);

  // (secondsOnFunnel rimosso assieme al popup exit-intent)

  return (
    <>
    <div ref={rootRef} className={`rounded-xl shadow-sm w-full overflow-hidden ${wrapper}`}>
      {/* Header sticky con progress bar + step counter + tempo stimato */}
      <div
        className={`sticky top-0 z-10 backdrop-blur-md border-b border-current/10 ${
          isLight || forceWhite ? "bg-white/95" : "bg-navy-light/80"
        }`}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 pt-3 pb-2">
          {step > 0 && step < 5 ? (
            <button
              onClick={() => {
                haptic("tap");
                const next = Math.max(0, step - 1) as Step;
                // Se torna alla prima pagina (calendario), sblocca subito la nuova selezione
                if (next === 0) {
                  setForm((f) => ({ ...f, date: "", time: "" }));
                }
                setStep(next);
              }}
              className="flex items-center gap-1 text-[0.7rem] hover:opacity-70"
            >
              <ArrowLeft className="h-3 w-3" /> Indietro
            </button>
          ) : (
            <span className={eyebrow}>{step === 5 ? "Confermato" : "Prenota analisi"}</span>
          )}
          {step < 5 && (
            <span className={`text-[0.65rem] font-semibold ${mutedText}`}>
              Step {step + 1} di {totalSteps} · ~{secondsLeft}s
            </span>
          )}
        </div>
        {step < 5 && (
          <div className="h-1 bg-current/5">
            <div
              className="h-full bg-brand transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </div>

      <div className="px-4 sm:px-5 py-4 sm:py-5">
        {/* STEP 0 — CALENDAR */}
        {step === 0 && (
          <div>
            <h3 className="text-base sm:text-lg font-semibold leading-tight">
              Scegli giorno e orario per la consulenza
            </h3>
            <p className={`text-sm mt-1 mb-4 ${mutedText}`}>
              Online · 30 min · <span className="hl-nextgen font-semibold">gratis</span> · Google Meet
            </p>

            {/* Quando l'utente ha già selezionato data + ora, mostriamo SOLO la conferma
                e nascondiamo il calendario per evitare doppi tap accidentali e dare
                feedback chiaro che lo slot è bloccato. */}
            {form.date && form.time ? (
              <div className="animate-in fade-in zoom-in-95 duration-300">
                <div
                  className={`rounded-xl border-2 border-emerald-500/40 p-4 sm:p-5 flex items-start gap-3 ${
                    lightSurface ? "bg-emerald-50" : "bg-emerald-500/10"
                  }`}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-pulse-success">
                    <CheckCircle2 className="h-5 w-5 icon-pop" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-emerald-600">
                      Slot bloccato per te
                    </div>
                    <div className={`mt-1 text-sm sm:text-base font-bold capitalize ${lightSurface ? "text-ink" : "text-white"}`}>
                      {bookingPhrase.replace(/^per\s+/, "")}
                    </div>
                    <div className={`mt-1 text-xs ${mutedText}`}>
                      Online · 30 min · Google Meet
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    haptic("tap");
                    setForm((f) => ({ ...f, date: "", time: "" }));
                  }}
                  className={`mt-3 text-[11px] underline underline-offset-2 ${mutedText} hover:text-brand`}
                >
                  Cambia data o orario
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 mr-auto">
                    <CalendarDays className="h-4 w-4 text-brand" />
                    <span className="text-sm font-bold">
                      {MONTHS_IT[viewMonth.m]} {viewMonth.y}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!canGoPrevMonth) return;
                        const m = viewMonth.m - 1;
                        setViewMonth(m < 0 ? { y: viewMonth.y - 1, m: 11 } : { y: viewMonth.y, m });
                      }}
                      disabled={!canGoPrevMonth}
                      className={`h-7 w-7 flex items-center justify-center rounded-md border transition-colors ${
                        !canGoPrevMonth
                          ? "opacity-30 cursor-not-allowed border-current/10"
                          : isLight
                            ? "border-ink/15 hover:border-brand hover:text-brand"
                            : "border-white/15 hover:border-brand hover:text-brand"
                      }`}
                      aria-label="Mese precedente"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const m = viewMonth.m + 1;
                        setViewMonth(m > 11 ? { y: viewMonth.y + 1, m: 0 } : { y: viewMonth.y, m });
                      }}
                      className={`h-7 w-7 flex items-center justify-center rounded-md border transition-colors ${
                        lightSurface
                          ? "border-ink/15 hover:border-brand hover:text-brand"
                          : "border-white/15 hover:border-brand hover:text-brand"
                      }`}
                      aria-label="Mese successivo"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-1.5">
                  {WEEKDAYS_SHORT.map((w) => (
                    <div
                      key={w}
                      className={`text-center text-[11px] sm:text-[10px] font-semibold uppercase tracking-wide ${mutedText}`}
                    >
                      {w}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {monthMatrix.map((cell, i) => {
                    if (!cell.date || !cell.iso) {
                      return <div key={i} className="aspect-square" />;
                    }
                    const available = isDayAvailable(cell.date);
                    const selected = form.date === cell.iso;
                    const isToday = cell.iso === isoFromDate(today);
                    return (
                      <button
                        key={i}
                        type="button"
                        data-track="funnel_date_pick"
                        onClick={() => available && handleDatePick(cell.date!)}
                        disabled={!available}
                        className={`day-pop aspect-square flex items-center justify-center text-sm rounded-full font-semibold transition-all ${
                          selected
                            ? "bg-brand text-brand-foreground"
                            : available
                              ? isLight
                                ? "bg-brand/10 text-brand hover:bg-brand hover:text-brand-foreground active:scale-95"
                                : "bg-brand/15 text-brand hover:bg-brand hover:text-brand-foreground active:scale-95"
                              : isLight
                                ? "text-ink-muted/40 cursor-not-allowed"
                                : "text-white/25 cursor-not-allowed"
                        } ${isToday && !selected ? "ring-1 ring-brand/40" : ""}`}
                      >
                        {cell.date.getDate()}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-center gap-4 mt-3 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-brand/20 border border-brand/40" />
                    <span className={mutedText}>Disponibile</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                    <span className={mutedText}>Selezionato</span>
                  </span>
                </div>

                {form.date && (
                  <div
                    ref={timeRef}
                    className="mt-5 scroll-mt-24 animate-in fade-in slide-in-from-bottom-2 duration-300 border-t border-current/10 pt-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="h-4 w-4 text-brand" />
                      <span className="text-sm font-bold capitalize">
                        {new Date(form.date).toLocaleDateString("it-IT", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                      </span>
                    </div>
                    {availableSlotsForDate.length === 0 ? (
                      <p className={`text-sm ${mutedText} text-center py-4`}>
                        Nessun orario disponibile per questa data. Scegli un altro giorno.
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin">
                        {availableSlotsForDate.map((t) => (
                          <button
                            key={t}
                            data-track="funnel_time_pick"
                            onClick={() => handleTimePick(t)}
                            className={`text-sm font-semibold py-2.5 rounded-md border transition-all active:scale-95 ${
                              form.time === t
                                ? "bg-brand text-brand-foreground border-brand"
                                : isLight
                                  ? "border-ink/20 text-ink hover:border-brand hover:text-brand hover:bg-brand/5"
                                  : "border-white/20 text-white hover:border-brand hover:text-brand hover:bg-brand/10"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className={`mt-3 text-xs text-center ${mutedText}`}>
                      Dopo la selezione passi al prossimo step automaticamente
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* STEP 1 — PORTATORE (next-gen, micro-fade) */}
        {step === 1 && (
          <div className="space-y-5 animate-[ngFade_.15s_ease-out]">
            <div className="text-center sm:text-left">
              <h3 className="text-lg sm:text-xl font-bold leading-tight tracking-tight text-ink">
                Sei già portatore?
              </h3>
              <p className="text-sm mt-1.5 text-ink-muted">
                Ci aiuta a personalizzare la consulenza in base alla tua esperienza.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { v: "si" as const, title: "Sì, sono già portatore", sub: "Ho già un impianto / protesi", Icon: UserCheck },
                { v: "no" as const, title: "No, è la prima volta", sub: "Mi sto informando ora", Icon: Sparkles },
              ].map((o) => {
                const active = form.portatore === o.v;
                const Ico = o.Icon;
                return (
                  <button
                    key={o.v}
                    type="button"
                    data-track="funnel_portatore"
                    onClick={() => pickPortatore(o.v)}
                    className={`ng-choice group relative w-full text-left p-3.5 sm:p-4 rounded-2xl border bg-white transition-[border-color,box-shadow,transform] duration-150 active:scale-[0.99] ${
                      active
                        ? "ng-choice--active border-brand"
                        : "border-zinc-200 hover:border-brand/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-3.5">
                      <span
                        className={`ng-choice__icon flex-shrink-0 grid place-items-center rounded-xl transition-colors duration-150 h-12 w-12 sm:h-12 sm:w-12 ${
                          active
                            ? "bg-brand text-brand-foreground"
                            : "bg-zinc-100 text-ink-muted group-hover:bg-brand/10 group-hover:text-brand"
                        }`}
                      >
                        <Ico className="h-5 w-5 sm:h-5 sm:w-5" strokeWidth={2.2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] sm:text-base font-semibold text-ink leading-tight">
                          {o.title}
                        </div>
                        <div className="text-[13px] sm:text-sm text-ink-muted mt-0.5 leading-snug">
                          {o.sub}
                        </div>
                      </div>
                      <span
                        className={`flex-shrink-0 h-5 w-5 rounded-full grid place-items-center text-[11px] font-bold transition-opacity duration-150 ${
                          active ? "bg-brand text-white opacity-100" : "opacity-0"
                        }`}
                      >
                        ✓
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-center text-ink-muted">
              Risposta riservata · serve solo al consulente
            </p>
          </div>
        )}

        {/* STEP 2 — DISAGIO termometro 1-10: numeri grandi + 1 etichetta corta sotto.
            Copy product-coherent: misura quanto la perdita di capelli pesa OGGI nella vita reale. */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="text-center">
              <h3 className="text-base sm:text-lg font-semibold leading-tight">
                Quanto la perdita di capelli ti pesa oggi?
              </h3>
            </div>

            {(() => {
              const STOPS = [
                "#2563eb","#1d8fd6","#06b6d4","#14b8a6","#22c55e",
                "#a3b800","#eab308","#f97316","#ef4444","#dc2626",
              ];

              const mix = (a: string, b: string, t: number): string => {
                const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
                const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
                const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
                const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
                const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
                return `rgb(${r}, ${g}, ${bl})`;
              };

              // Etichette CORTE (max 10 char) per non andare mai a capo nel proprio slot.
              // Coerenti col prodotto: parlano di vissuto reale, non di "dolore clinico".
              const MICRO: { label: string; tone: string }[] = [
                { label: "Sereno",     tone: "text-blue-600" },
                { label: "Tranquillo", tone: "text-blue-500" },
                { label: "Ci penso",   tone: "text-cyan-600" },
                { label: "Fastidio",   tone: "text-teal-600" },
                { label: "Mi pesa",    tone: "text-emerald-600" },
                { label: "Spesso",     tone: "text-lime-600" },
                { label: "Mi blocca",  tone: "text-yellow-600" },
                { label: "Forte",      tone: "text-orange-600" },
                { label: "Mi rovina",  tone: "text-red-500" },
                { label: "Disperato",  tone: "text-red-600" },
              ];

              const NumBtn = ({ n, prevColor, nextColor }: { n: number; prevColor: string; nextColor: string }) => {
                const active = form.disagio === n;
                const color = STOPS[n - 1];
                const leftEdge = mix(color, prevColor, 0.5);
                const rightEdge = mix(color, nextColor, 0.5);
                const bg = `linear-gradient(90deg, ${leftEdge} 0%, ${color} 50%, ${rightEdge} 100%)`;
                return (
                  <button
                    type="button"
                    data-track="funnel_disagio"
                    onClick={() => pickDisagio(n)}
                    style={{ background: bg }}
                    className={`relative flex-1 min-w-0 h-12 sm:h-14 rounded-xl text-white font-bold text-base sm:text-lg tabular-nums select-none transition-all duration-150 active:scale-[0.95] shadow-[0_2px_6px_-2px_rgba(0,0,0,0.25)] ${
                      active
                        ? "z-10 scale-[1.1] ring-[3px] ring-white shadow-[0_8px_22px_-6px_rgba(0,0,0,0.45)]"
                        : "hover:brightness-110"
                    }`}
                    aria-label={`Livello ${n}: ${MICRO[n - 1].label}`}
                  >
                    <span className="relative z-10 flex items-center justify-center h-full drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">
                      {n}
                    </span>
                  </button>
                );
              };

              const Row = ({ nums }: { nums: number[] }) => (
                <div className="space-y-1.5">
                  <div className="flex w-full gap-1.5">
                    {nums.map((n, i) => {
                      const prev = STOPS[(nums[i - 1] ?? n) - 1];
                      const next = STOPS[(nums[i + 1] ?? n) - 1];
                      return <NumBtn key={n} n={n} prevColor={prev} nextColor={next} />;
                    })}
                  </div>
                  <div className="flex w-full gap-1.5">
                    {nums.map((n) => (
                      <div
                        key={n}
                        className={`flex-1 min-w-0 text-center text-[10px] sm:text-[11px] font-semibold leading-tight tracking-tight truncate ${MICRO[n - 1].tone} ${form.disagio === n ? "opacity-100" : "opacity-70"}`}
                        title={MICRO[n - 1].label}
                      >
                        {MICRO[n - 1].label}
                      </div>
                    ))}
                  </div>
                </div>
              );

              return (
                <div className="space-y-3">
                  {/* Mobile: 2 righe (1-5 / 6-10) → ogni etichetta ha ~20% di larghezza, niente overflow */}
                  <div className="sm:hidden space-y-3">
                    <Row nums={[1, 2, 3, 4, 5]} />
                    <Row nums={[6, 7, 8, 9, 10]} />
                  </div>
                  {/* Desktop/Tablet: 1 riga 1-10 */}
                  <div className="hidden sm:block">
                    <Row nums={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} />
                  </div>

                  {/* Ancore semantiche: Sereno / Mi pesa / Disperato */}
                  <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold uppercase tracking-wider px-1 whitespace-nowrap pt-1">
                    <span className="text-blue-600">Sereno</span>
                    <span className="text-emerald-600">Mi pesa</span>
                    <span className="text-red-600">Disperato</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* STEP 3 — URGENZA (densità ridotta, leggibilità <300ms su mobile) */}
        {step === 3 && (
          <div className="space-y-3 animate-[ngFade_.15s_ease-out]">
            <div>
              <h3 className="text-[16px] sm:text-[17px] font-semibold leading-tight tracking-tight text-ink">
                Quando vuoi sistemare?
              </h3>
            </div>

            <div className="space-y-1.5">
              {URGENZA_OPTIONS.map((o) => {
                const active = form.urgenza === o.v;
                return (
                  <button
                    key={o.v}
                    type="button"
                    data-track="funnel_urgenza"
                    onClick={() => pickUrgenza(o.v)}
                    className={`ng-urgenza w-full text-left px-3 py-2.5 sm:py-3 rounded-xl border transition-[border-color,background-color] duration-150 active:scale-[0.995] flex items-center gap-2.5 ${
                      active
                        ? "ng-urgenza--active border-brand bg-brand text-brand-foreground"
                        : "border-zinc-200 bg-white text-ink/80 hover:border-brand/40"
                    }`}
                  >
                    <span
                      className={`flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                        active ? "bg-white border-white" : "border-zinc-300"
                      }`}
                    >
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-brand" />}
                    </span>
                    <span className={`text-[14px] sm:text-[15px] font-medium leading-snug ${active ? "" : "text-ink/80"}`}>
                      {o.l}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 4 — CONTACT */}
        {step === 4 && (
          <div className="space-y-4">
            {/* HERO: Analisi completata + sottotitolo personalizzato */}
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center ring-4 ring-emerald-500/10 ring-pulse-success">
                <CheckCircle2 className="h-6 w-6 icon-pop" strokeWidth={2.5} />
              </div>
              <div className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-emerald-600">
                Analisi completata con successo
              </div>
              <h3 className="text-base sm:text-lg font-semibold leading-tight">
                Stiamo analizzando le tue risposte
              </h3>
              <p className={`text-sm leading-snug ${mutedText}`}>
                Inserisci i tuoi dati per parlare con un esperto della tua situazione specifica.
              </p>
            </div>

            {/* ANCORA VISIVA: riepilogo risposte + slot scelto */}
            <div
              className={`rounded-lg border p-3 space-y-1.5 ${
                lightSurface ? "border-ink/15 bg-ink/[0.02]" : "border-white/15 bg-white/[0.04]"
              }`}
            >
              <div className={`text-[0.6rem] font-bold uppercase tracking-wider ${mutedText}`}>
                Riepilogo
              </div>
              {bookingPhrase && (
                <div className="flex items-start gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 mt-0.5 text-brand flex-shrink-0" />
                  <span className="capitalize">
                    <span className="font-semibold">{bookingPhrase.replace(/^per\s+/, "")}</span>
                  </span>
                </div>
              )}
            </div>

            <EmailField
              label="Email"
              hint="Niente spam. Solo informazioni utili."
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              inputCls={inputCls}
              labelCls={labelCls}
              valid={emailValid}
            />
            <Field
              label="Nome e Cognome"
              hint="Così sappiamo come chiamarti."
              value={form.fullName}
              onChange={(v) => setForm({ ...form, fullName: v })}
              inputCls={inputCls}
              labelCls={labelCls}
              placeholder="Es. Mario Rossi"
              autoComplete="name"
              inputMode="text"
              name="name"
              valid={fullNameValid}
              icon={<UserIcon className="h-4 w-4" strokeWidth={1.75} />}
            />
            <Field
              label="Città"
              hint="Per offrirti servizi disponibili nella tua zona."
              value={form.citta}
              onChange={(v) => setForm({ ...form, citta: v })}
              inputCls={inputCls}
              labelCls={labelCls}
              placeholder="Es. Milano"
              autoComplete="address-level2"
              inputMode="text"
              name="city"
              valid={form.citta.trim().length >= 2}
              icon={<MapPin className="h-4 w-4" strokeWidth={1.75} />}
            />
            <PhoneField
              label="Telefono"
              hint="Solo per contatto diretto. Nessuna chiamata indesiderata."
              value={form.telefono}
              onChange={(v) => setForm({ ...form, telefono: v })}
              labelCls={labelCls}
              valid={telefonoValid}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}

            {/* CTA premium navy con shine animato */}
            <Button
              data-track="funnel_submit"
              onClick={submit}
              disabled={submitting}
              className="btn-premium magnet-pulse w-full h-12 text-base font-bold tracking-wide uppercase rounded-xl"
              size="lg"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>Richiedi analisi <span className="hl-nextgen">gratuita</span> <span className="arrow-nudge">→</span></>
              )}
            </Button>

            {/* Trust GDPR + bar — centrati e con font più piccolo del CTA */}
            <div className="space-y-1.5 pt-1 text-center">
              <div className={`flex items-center justify-center gap-1.5 text-[11px] ${mutedText}`}>
                <Lock className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                <span>I tuoi dati sono al sicuro · Trattati secondo il GDPR</span>
              </div>
              <div className={`flex items-center justify-center flex-wrap gap-x-3 gap-y-1 ${mutedText}`}>
                <span className="flex items-center gap-1 text-[10px]">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" /> Niente spam
                </span>
                <span className="flex items-center gap-1 text-[10px]">
                  <Timer className="h-3 w-3 text-emerald-600" /> Risposta in 24h
                </span>
                <span className="flex items-center gap-1 text-[10px]">
                  <CheckCheck className="h-3 w-3 text-emerald-600" /> Esperto verificato
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5 — THANK YOU */}
        {step === 5 && (
          <div className="space-y-5 py-1">
            <div className="text-center space-y-3">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center ring-4 ring-emerald-500/10 ring-pulse-success">
                <CheckCircle2 className="h-7 w-7 icon-pop" />
              </div>
              <div>
                <div className={`text-[0.7rem] font-semibold uppercase tracking-[0.2em] ${lightSurface ? "text-emerald-600" : "text-emerald-400"}`}>
                  Consulenza confermata
                </div>
                <h3 className="text-lg sm:text-xl font-bold mt-1 leading-tight">
                  Il tuo specialista ti aspetterà all'orario esatto.
                </h3>
                <p className={`text-sm mt-2 ${mutedText}`}>
                  {formatBookingPhrase(form.date, form.time)}
                </p>
              </div>
            </div>

            <div
              className={`rounded-lg border p-3.5 space-y-2.5 ${
                lightSurface ? "border-ink/15 bg-ink/[0.02]" : "border-white/15 bg-white/[0.04]"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <CalendarDays className="h-4 w-4 mt-0.5 text-brand flex-shrink-0" />
                <div className="text-xs">
                  <div className={`font-semibold uppercase tracking-wide text-[0.6rem] ${mutedText}`}>
                    Data e ora
                  </div>
                  <div className="font-bold text-sm capitalize">
                    {formatBookingPhrase(form.date, form.time).replace(/^per\s+/, "")}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Video className="h-4 w-4 mt-0.5 text-brand flex-shrink-0" />
                <div className="text-xs">
                  <div className={`font-semibold uppercase tracking-wide text-[0.6rem] ${mutedText}`}>
                    Modalità
                  </div>
                  <div className="font-bold text-sm">Google Meet — Video chiamata</div>
                </div>
              </div>
            </div>

            <div
              className={`rounded-lg border p-3 flex items-start gap-2.5 ${
                lightSurface
                  ? "border-amber-500/40 bg-amber-500/5 text-amber-900"
                  : "border-amber-400/40 bg-amber-400/10 text-amber-200"
              }`}
            >
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="text-xs leading-relaxed">
                <div className="font-bold uppercase tracking-wide text-[0.65rem] mb-0.5">
                  Sii puntuale
                </div>
                <p>
                  Il tuo specialista ti aspetterà all'orario esatto. Collegati 2 minuti prima per
                  non perdere nemmeno un secondo della consulenza.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Smartphone className={`h-3.5 w-3.5 ${mutedText}`} />
                <p className={`text-[0.7rem] font-semibold uppercase tracking-wider ${mutedText}`}>
                  Partecipa da smartphone — installa l'app ufficiale
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={ANDROID_LINK}
                  target="_blank"
                  rel="noreferrer"
                  className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all hover:border-brand hover:shadow-sm ${
                    lightSurface
                      ? "border-ink/20 bg-white text-ink"
                      : "border-white/20 bg-white/5 text-white"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={`w-7 h-7 flex-shrink-0 ${lightSurface ? "fill-ink" : "fill-white"}`}
                    xmlns="http://www.w3.org/2000/svg"
                    aria-label="Google Play"
                  >
                    <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.117 12l2.581-2.491zM5.864 2.658L16.802 8.99l-2.303 2.303L5.864 2.658z" />
                  </svg>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-[0.6rem] uppercase tracking-wide opacity-60 leading-none">
                      Scarica su
                    </div>
                    <div className="text-xs font-bold leading-tight mt-0.5">Google Play</div>
                  </div>
                </a>
                <a
                  href={IOS_LINK}
                  target="_blank"
                  rel="noreferrer"
                  className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all hover:border-brand hover:shadow-sm ${
                    lightSurface
                      ? "border-ink/20 bg-white text-ink"
                      : "border-white/20 bg-white/5 text-white"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={`w-7 h-7 flex-shrink-0 ${lightSurface ? "fill-ink" : "fill-white"}`}
                    xmlns="http://www.w3.org/2000/svg"
                    aria-label="App Store"
                  >
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-[0.6rem] uppercase tracking-wide opacity-60 leading-none">
                      Scarica su
                    </div>
                    <div className="text-xs font-bold leading-tight mt-0.5">App Store</div>
                  </div>
                </a>
              </div>
            </div>

            <div className={`flex items-center justify-center gap-1.5 text-[0.7rem] ${mutedText}`}>
              <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>Riceverai conferma via email entro pochi minuti</span>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Popup motivo "perché ci contatti?" — Drawer top su mobile (sopra la tastiera), centrato su desktop */}
    <Dialog open={portatoreMotivoOpen} onOpenChange={(o) => { if (!o) confirmPortatoreMotivo(); else setPortatoreMotivoOpen(true); }}>
      <DialogContent
        
        className="
          p-0 gap-0 border-0 shadow-2xl bg-white text-slate-900
          max-w-md w-[calc(100%-1.5rem)]
          rounded-2xl
          sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
          top-4 left-1/2 -translate-x-1/2 translate-y-0
          sm:top-1/2
          data-[state=open]:slide-in-from-top-4 sm:data-[state=open]:slide-in-from-bottom-0
        "
      >
        <div className="px-4 pt-3 pb-3">
          <DialogHeader className="space-y-1 text-center sm:text-center">
            <DialogTitle className="text-slate-900 text-sm font-bold text-center w-full block leading-snug">
              Cosa non ti convince del tuo impianto
            </DialogTitle>
            <DialogDescription className="sr-only">
              Descrivi in una frase cosa non ti convince.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            ref={(el) => {
              if (el && portatoreMotivoOpen) {
                // Doppio tentativo: alcuni iOS richiedono un secondo focus
                // dopo che l'animazione del Dialog è terminata, altrimenti la
                // tastiera non sale.
                setTimeout(() => { try { el.focus({ preventScroll: true }); } catch { /* noop */ } }, 80);
                setTimeout(() => { try { el.focus({ preventScroll: true }); } catch { /* noop */ } }, 320);
              }
            }}
            value={form.portatoreMotivo}
            onChange={(e) => setForm((f) => ({ ...f, portatoreMotivo: e.target.value.slice(0, 280) }))}
            placeholder="Es. cerco un'attaccatura più naturale…"
            className="mt-2 min-h-[64px] text-sm bg-white text-slate-900 placeholder:text-slate-400 border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 focus-visible:shadow-[0_0_0_4px_rgba(59,130,246,0.12)] resize-none transition-shadow"
          />
          <div className="flex items-center justify-between gap-2 mt-2">
            <span className={`text-[10px] tabular-nums ${form.portatoreMotivo.length >= 260 ? "text-orange-500 font-semibold" : "text-slate-400"}`}>
              {form.portatoreMotivo.length}/280
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={confirmPortatoreMotivo}
                className="h-9 px-3 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                Salta
              </Button>
              <Button
                onClick={confirmPortatoreMotivo}
                className="h-9 px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
              >
                Continua
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Exit-intent popup rimosso su richiesta */}
    </>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  type = "text",
  inputCls,
  labelCls,
  placeholder,
  autoComplete,
  inputMode,
  valid,
  name,
  icon,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputCls?: string;
  labelCls?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric" | "decimal" | "search" | "url" | "none";
  valid?: boolean;
  name?: string;
  icon?: React.ReactNode;
}) {
  const showCheck = valid && value.trim().length > 0;
  return (
    <div>
      <Label className={`${labelCls ?? ""} text-sm font-semibold`}>{label}</Label>
      {hint && <p className="text-[11px] text-ink-muted mt-0.5 leading-snug">{hint}</p>}
      <div className="relative mt-1">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none">
            {icon}
          </span>
        )}
        <Input
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          className={`${inputCls ?? ""} h-11 text-base ${icon ? "pl-9" : ""} ${showCheck ? "pr-10" : ""}`}
        />
        {showCheck && (
          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500 pointer-events-none" />
        )}
      </div>
    </div>
  );
}

/* ============================================================
   PhoneField — prefisso +39 🇮🇹 fisso bloccato nel campo
   ============================================================ */
function PhoneField({
  label,
  hint,
  value,
  onChange,
  labelCls,
  valid,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  labelCls?: string;
  valid?: boolean;
}) {
  // Strip eventuale +39 dall'inizio per visualizzare solo il numero "puro"
  const stripPrefix = (raw: string) => {
    let s = raw.replace(/[^\d\s]/g, "").trim();
    if (s.startsWith("0039")) s = s.slice(4).trim();
    else if (s.startsWith("39") && s.length > 10) s = s.slice(2).trim();
    return s;
  };
  const display = stripPrefix(value.replace(/^\+39\s?/, ""));
  const showCheck = valid && display.length > 0;
  return (
    <div>
      <Label className={`${labelCls ?? ""} text-sm font-semibold`}>{label}</Label>
      {hint && <p className="text-[11px] text-ink-muted mt-0.5 leading-snug">{hint}</p>}
      <div className="mt-1 flex items-stretch h-11 rounded-md border border-input bg-white overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0">
        <div className="flex items-center gap-1.5 px-3 border-r border-zinc-200 bg-zinc-50 select-none shrink-0">
          <span aria-hidden className="text-base leading-none">🇮🇹</span>
          <span className="text-sm font-semibold text-ink tabular-nums">+39</span>
        </div>
        <div className="relative flex-1 min-w-0 flex items-center bg-white">
          <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" strokeWidth={1.75} />
          <Input
            type="tel"
            name="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="333 1234567"
            value={display}
            onChange={(e) => {
              const cleaned = stripPrefix(e.target.value);
              onChange(cleaned ? `+39 ${cleaned}` : "");
            }}
            className={`h-full w-full text-base text-ink placeholder:text-ink-muted/60 border-0 rounded-none bg-white pl-9 focus-visible:ring-0 focus-visible:ring-offset-0 ${showCheck ? "pr-10" : ""}`}
          />
          {showCheck && (
            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500 pointer-events-none" />
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   EmailField — autocomplete domini con fuzzy matching
   ============================================================ */
const EMAIL_DOMAINS = [
  "gmail.com", "googlemail.com", "outlook.com", "outlook.it", "hotmail.com", "hotmail.it",
  "yahoo.com", "yahoo.it", "ymail.com", "libero.it", "alice.it", "tin.it", "tiscali.it",
  "virgilio.it", "live.it", "live.com", "icloud.com", "me.com", "mac.com",
  "fastwebnet.it", "vodafone.it", "tim.it", "wind.it", "aruba.it", "pec.it",
  "email.it", "inwind.it", "msn.com", "protonmail.com", "proton.me", "gmx.com",
  "gmx.it", "mail.com", "zoho.com", "yandex.com", "fastmail.com",
];

function suggestDomains(input: string): string[] {
  const at = input.lastIndexOf("@");
  if (at < 0) return [];
  // Caratteri digitati dopo l'@ (gestisce anche multi-dot: nome.co@dom.com)
  const partial = input.slice(at + 1).toLowerCase().trim();
  if (partial === "") return EMAIL_DOMAINS.slice(0, 5);
  // 1) Prefix match (priorità massima)
  const prefix = EMAIL_DOMAINS.filter((d) => d.startsWith(partial));
  // 2) Substring (qualsiasi posizione)
  const contains = EMAIL_DOMAINS.filter(
    (d) => !d.startsWith(partial) && d.includes(partial),
  );
  // 3) Fuzzy: caratteri in ordine (gestisce typo veloci)
  const fuzzy = EMAIL_DOMAINS.filter((d) => {
    if (prefix.includes(d) || contains.includes(d)) return false;
    let i = 0;
    for (const ch of d) {
      if (ch === partial[i]) i++;
      if (i === partial.length) return true;
    }
    return false;
  });
  return [...prefix, ...contains, ...fuzzy].slice(0, 5);
}

function EmailField({
  label,
  hint,
  value,
  onChange,
  inputCls,
  labelCls,
  valid,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  inputCls?: string;
  labelCls?: string;
  valid?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const showCheck = valid && value.trim().length > 0;
  const at = value.lastIndexOf("@");
  const local = at >= 0 ? value.slice(0, at) : "";
  const suggestions = useMemo(() => (focused ? suggestDomains(value) : []), [value, focused]);
  const showSuggestions = focused && at >= 0 && suggestions.length > 0 && !valid;

  return (
    <div>
      <Label className={`${labelCls ?? ""} text-sm font-semibold`}>{label}</Label>
      {hint && <p className="text-[11px] text-ink-muted mt-0.5 leading-snug">{hint}</p>}
      <div className="relative mt-1">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" strokeWidth={1.75} />
        <Input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="nome@email.com"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          className={`${inputCls ?? ""} h-11 text-base pl-9 ${showCheck ? "pr-10" : ""}`}
        />
        {showCheck && (
          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500 pointer-events-none" />
        )}
        {showSuggestions && (
          <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border border-zinc-200 bg-white shadow-lg overflow-hidden animate-[ngFade_.12s_ease-out]">
            {suggestions.map((d) => (
              <button
                key={d}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(`${local}@${d}`);
                  setFocused(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-brand/10 transition-colors duration-100 flex items-baseline gap-1"
              >
                <span className="text-ink-muted truncate max-w-[40%]">{local}</span>
                <span className="text-brand font-semibold">@{d}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
