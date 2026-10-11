import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import {
  Sparkles,
  Dumbbell,
  Waves as WavesIcon,
  Sun,
  Flame,
  Droplets,
  Waves,
  SunMedium,
  XCircle,
} from "lucide-react";
import { BookingFunnel } from "@/landing/booking/BookingFunnel";
import {
  initScrollTracking,
  initClickTracking,
  initAdminCheck,
  initHeartbeat,
  initLivePresence,
  initHighQualityVisit,
  subscribeAdminStatus,
} from "@/landing/booking/tracking";
import { PlaceholderBox } from "@/components/landing/PlaceholderBox";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { Footer } from "@/components/landing/Footer";
import { ComparisonTable } from "@/components/landing/ComparisonTable";
import { CookieBanner } from "@/components/landing/CookieBanner";
import { StickyHeader } from "@/components/landing/StickyHeader";
import { VideoReviewsSection } from "@/components/landing/VideoReviewsSection";
import { RichText } from "@/components/landing/RichText";
import { MediaSlot } from "@/components/landing/MediaSlot";
import { useLandingContent } from "@/landing/landing-content";
import logo from "@/assets/logo-hair-genius.png";
import logoDark from "@/assets/logo-hair-genius-dark.png";

const MONTHS_IT = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

function getCountdown() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysLeft = Math.max(
    1,
    Math.ceil((lastDay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  );
  return {
    daysLeft,
    month: MONTHS_IT[now.getMonth()],
    nextMonth: MONTHS_IT[(now.getMonth() + 1) % 12],
  };
}

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Bio-Mimetic™ — Indistinguibile dalla cute" },
      {
        name: "description",
        content:
          "Impianto di grado clinico ingegnerizzato per essere indistruttibile alla vista. Analisi tecnica gratuita, slot limitati mensili.",
      },
    ],
  }),
});

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="eyebrow text-[0.7rem] flex items-center gap-2 justify-center">
      {children}
    </div>
  );
}

function Index() {
  // Render countdown only on client to avoid SSR/CSR hydration mismatch
  const { text, media } = useLandingContent();
  const [countdown, setCountdown] = useState<ReturnType<typeof getCountdown> | null>(null);
  useEffect(() => {
    setCountdown(getCountdown());
    let cleanupScroll: (() => void) | null = null;
    let cleanupClick: (() => void) | null = null;
    let cleanupHeartbeat: (() => void) | null = null;
    let cleanupPresence: (() => void) | null = null;
    let cleanupHQV: (() => void) | null = null;
    // Aspetta di sapere se l'utente è admin: se sì NON tracciamo nulla.
    initAdminCheck().then((isAdmin) => {
      if (isAdmin) return;
      cleanupScroll = initScrollTracking();
      cleanupClick = initClickTracking();
      cleanupHeartbeat = initHeartbeat();
      cleanupPresence = initLivePresence();
      // HighQualityVisit: dispatch CAPI quando l'utente sta >40s o scrolla >50%
      cleanupHQV = initHighQualityVisit(40, 50);
    });
    const unsubscribeAdmin = subscribeAdminStatus((isAdmin) => {
      if (isAdmin) {
        cleanupScroll?.();
        cleanupClick?.();
        cleanupHeartbeat?.();
        cleanupPresence?.();
        cleanupHQV?.();
        cleanupScroll = null;
        cleanupClick = null;
        cleanupHeartbeat = null;
        cleanupPresence = null;
        cleanupHQV = null;
      }
    });
    return () => {
      unsubscribeAdmin();
      cleanupScroll?.();
      cleanupClick?.();
      cleanupHeartbeat?.();
      cleanupPresence?.();
      cleanupHQV?.();
    };
  }, []);
  const daysLeft = countdown?.daysLeft ?? "—";
  const month = countdown?.month ?? "—";
  const nextMonth = countdown?.nextMonth ?? "—";
  return (
    <main id="top" className="min-h-screen overflow-x-hidden">
      <StickyHeader />
      {/* HERO */}
      <section className="bg-blueprint relative overflow-hidden spotlight">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-10 pb-20 lg:pt-14 lg:pb-28 relative">
          {/* Logo stamp */}
          <div className="brackets inline-flex items-center justify-center px-5 py-3 mb-12">
            <span className="br-tr" />
            <span className="br-bl" />
            <img
              src={logo}
              alt="Hair Genius Labs"
              className="h-9 md:h-10 w-auto select-none"
              draggable={false}
            />
          </div>

          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-start">
            {/* Left col */}
            <div>
              <p className="ng-hero-eyebrow mb-4">
                <span className="ng-hero-eyebrow__line">{text("hero.eyebrow1")}</span>
                <span className="ng-hero-eyebrow__line ng-hero-eyebrow__line--accent">{text("hero.eyebrow2")}</span>
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
                <RichText value={text("hero.h1")} highlightClass="hl-nextgen" />
              </h1>

              <div className="mt-6 ng-error-pill inline-flex items-center gap-2.5 rounded-full pl-1.5 pr-4 py-1.5 max-w-xl">
                <span className="ng-error-pill__icon grid place-items-center w-7 h-7 rounded-full shrink-0">
                  <XCircle className="h-4 w-4" strokeWidth={2.5} />
                </span>
                <span className="text-sm md:text-[15px] font-semibold text-white/90 leading-snug">
                  {text("hero.errorPill")}
                </span>
              </div>

              <p className="mt-5 text-white/65 leading-relaxed max-w-xl">
                <RichText value={text("hero.body")} highlightClass="text-white font-semibold" />
              </p>

              <div className="mt-10 border-l-2 border-brand pl-5 max-w-md">
                <div className="eyebrow text-[0.65rem]">
                  {text("hero.priceLabel")}
                </div>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-white/40 line-through text-lg">
                    {text("hero.priceOld")}
                  </span>
                  <span className="text-2xl md:text-3xl font-bold text-white">
                    {text("hero.priceNew")} <span className="hl-nextgen">{text("hero.priceHighlight")}</span>
                  </span>
                </div>
                <p className="mt-2 text-sm text-white/60">
                  Scade entro <span className="text-white font-semibold">{month}</span> ·
                  ultimi <span className="text-white font-semibold">{daysLeft}</span> giorni.
                </p>
              </div>

            </div>

            {/* Right col - calendar */}
            <div className="lg:pt-2 w-full max-w-md md:max-w-lg lg:max-w-none mx-auto">
              <div className="text-center text-[0.7rem] tracking-[0.22em] uppercase text-white/55 mb-3">
                {text("hero.calendarTopLabel")}
              </div>
              <BookingFunnel />
              <div className="text-center text-[0.7rem] tracking-[0.22em] uppercase text-white/55 mt-3">
                <RichText value={text("hero.calendarBottomLabel")} highlightClass="hl-nextgen" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 02 */}
      <section className="bg-light-panel">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <div className="eyebrow">{text("s02.eyebrow")}</div>
              <h2 className="mt-4 text-3xl md:text-5xl font-bold tracking-tight text-ink leading-[1.05]">
                <RichText value={text("s02.h2")} highlightClass="text-brand" />
              </h2>

              <p className="mt-6 text-ink-muted leading-relaxed max-w-xl">
                <RichText value={text("s02.body")} highlightClass="text-brand font-semibold" />
              </p>

              <div className="mt-6 border-l-2 border-ink pl-5 text-ink-muted max-w-xl">
                <p>
                  <RichText value={text("s02.note")} highlightClass="font-bold text-ink" />
                </p>
              </div>
            </div>

            <MediaSlot
              src={media("s02.media")}
              type="video"
              caption="Video stress test meccanico della membrana"
              className="min-h-[520px]"
            />
          </div>
        </div>
      </section>

      {/* SECTION 03 — Test della Verità (sx) + Tabella comparativa & Scheda Tecnica (dx) */}
      <section className="bg-blueprint">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
            <div>
              <Eyebrow>{text("s03.eyebrowL")}</Eyebrow>
              <h3 className="mt-4 text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
                <RichText value={text("s03.h3L")} highlightClass="text-white/85" />
              </h3>

              <div className="mt-6">
                <MediaSlot
                  src={media("s03.media")}
                  type="video"
                  light={false}
                  caption="Video ravvicinato · pettine che scopre il frontale"
                  className="min-h-[360px]"
                />
              </div>

              <div className="mt-6">
                <p className="text-sm md:text-base text-white/75 leading-relaxed">
                  <RichText value={text("s03.bodyL1")} highlightClass="text-brand font-semibold" />
                </p>
                <p className="mt-3 text-sm md:text-base font-semibold text-brand leading-relaxed">
                  <RichText value={text("s03.bodyL2")} highlightClass="text-brand" />
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
                <RichText value={text("s03.h2R")} highlightClass="text-white/85" />
              </h2>
              <div className="mt-6">
                <ComparisonTable />
              </div>

              <div className="mt-10 flex items-center gap-2 mb-5 justify-center">
                <span className="ng-stats__dot" />
                <span className="text-[0.6rem] tracking-[0.28em] uppercase text-brand font-bold">
                  Scheda Tecnica · Bio-Mimetic™
                </span>
              </div>
              <div className="grid grid-cols-[1fr_1px_1fr_1px_1fr] items-stretch gap-x-4 text-center">
                {[
                  { big: text("s03.stat1Big"), sub: text("s03.stat1Sub") },
                  { big: text("s03.stat2Big"), sub: text("s03.stat2Sub") },
                  { big: text("s03.stat3Big"), sub: text("s03.stat3Sub") },
                ].map((s, i, arr) => (
                  <React.Fragment key={i}>
                    <div>
                      <div className="text-aurora text-xl md:text-2xl font-bold tracking-tight">
                        {s.big}
                      </div>
                      <div className="mt-2 text-[0.65rem] tracking-widest uppercase text-white/60 whitespace-pre-line leading-relaxed">
                        {s.sub}
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="ng-stats__divider" aria-hidden />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 04 — Vivi la tua vita */}
      <section className="bg-white-trama">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
          <div className="text-center max-w-3xl mx-auto">
            <div className="eyebrow">{text("s04.eyebrow")}</div>
            <h2 className="mt-4 text-3xl md:text-5xl font-bold tracking-tight text-ink leading-[1.05]">
              <RichText value={text("s04.h2")} highlightClass="text-brand" />
            </h2>
            <p className="mt-4 text-ink-muted max-w-2xl mx-auto">
              <RichText value={text("s04.intro")} highlightClass="text-brand font-semibold" />
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {[
                { Icon: Flame, label: text("s04.pill1"), anim: "ng-icon-flame" },
                { Icon: Droplets, label: text("s04.pill2"), anim: "ng-icon-drip" },
                { Icon: Waves, label: text("s04.pill3"), anim: "ng-icon-wave" },
                { Icon: SunMedium, label: text("s04.pill4"), anim: "ng-icon-sun" },
              ].map(({ Icon, label, anim }) => (
                <div
                  key={label}
                  className="ng-pill group relative inline-flex items-center gap-2.5 rounded-full pl-1.5 pr-4 py-1.5 text-sm font-semibold text-ink"
                >
                  <span className="ng-pill__icon relative grid place-items-center w-7 h-7 rounded-full text-white shadow-[0_4px_12px_-4px_color-mix(in_oklab,var(--brand)_60%,transparent)]">
                    <Icon className={`h-3.5 w-3.5 relative z-10 ${anim}`} strokeWidth={2.25} />
                  </span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              {
                n: "01",
                Icon: Dumbbell,
                anim: "ng-ic-dumb",
                title: text("s04.p1Title"),
                hook: text("s04.p1Hook"),
                kicker: text("s04.p1Kicker"),
                desc: text("s04.p1Desc"),
              },
              {
                n: "02",
                Icon: WavesIcon,
                anim: "ng-ic-wave2",
                title: text("s04.p2Title"),
                hook: text("s04.p2Hook"),
                kicker: text("s04.p2Kicker"),
                desc: text("s04.p2Desc"),
              },
              {
                n: "03",
                Icon: Sun,
                anim: "ng-ic-sun2",
                title: text("s04.p3Title"),
                hook: text("s04.p3Hook"),
                kicker: text("s04.p3Kicker"),
                desc: text("s04.p3Desc"),
              },
            ].map(({ n, Icon, anim, title, hook, kicker, desc }) => (
              <div key={n} className="ng-pillar p-7">
                <span className="ng-pillar__num">{n}</span>
                <div className="ng-pillar__icon mb-6">
                  <Icon className={`h-6 w-6 relative z-10 ${anim}`} strokeWidth={2} />
                </div>
                <h3 className="text-lg font-bold text-ink tracking-tight">{title}</h3>
                <p className="mt-2 text-sm font-semibold text-brand leading-snug">{hook}</p>
                <div className="ng-pillar__kicker mt-3">{kicker}</div>
                <p className="mt-3 text-sm text-ink-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 05 — Il Confronto */}
      <section className="bg-blueprint">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
          <div className="text-center max-w-3xl mx-auto">
            <Eyebrow>{text("s05.eyebrow")}</Eyebrow>
            <h2 className="mt-4 text-3xl md:text-5xl font-bold tracking-tight">
              {text("s05.h2")}
            </h2>
            <p className="mt-4 text-white/65">
              <RichText value={text("s05.body")} highlightClass="text-brand font-semibold" />
            </p>
          </div>

          <div className="mt-12 grid md:grid-cols-2 gap-8">
            <div>
              <div className="inline-block bg-navy-light text-white text-[0.7rem] tracking-[0.22em] uppercase font-semibold px-3 py-1.5 rounded-sm mb-3">
                Prima · Patch cutanea
              </div>
              <MediaSlot
                src={media("s05.beforeImage")}
                type="image"
                light={false}
                caption="PRIMA · Patch cutanea industriale"
                className="min-h-[460px]"
              />
            </div>
            <div>
              <div className="shine inline-block bg-brand text-brand-foreground text-[0.7rem] tracking-[0.22em] uppercase font-semibold px-3 py-1.5 rounded-sm mb-3">
                Zero-Edge del Bio-Mimetic™
              </div>
              <MediaSlot
                src={media("s05.afterImage")}
                type="image"
                light={false}
                caption="DOPO · Bio-Mimetic™ · Zero-Edge"
                className="min-h-[460px]"
              />
            </div>
          </div>
        </div>
      </section>


      {/* BANNER — tra Confronto e Recensioni */}
      <section className="bg-white-grid border-y border-ink/10 relative overflow-hidden">
        <img
          src={logoDark}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none select-none absolute inset-0 m-auto w-[80%] md:w-[60%] max-w-3xl opacity-[0.06] object-contain"
        />
        <div className="relative max-w-5xl mx-auto px-6 lg:px-10 py-20 lg:py-28 text-center">
          <div className="eyebrow text-[0.7rem] flex items-center gap-2 justify-center text-brand">
            {text("banner.eyebrow")}
          </div>
          <h2 className="mt-6 text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] text-ink">
            <RichText value={text("banner.h2")} highlightClass="text-brand" />
          </h2>
        </div>
      </section>


      {/* SECTION 06 — Video Recensioni */}
      <VideoReviewsSection />

      {/* SECTION 07 — FAQ */}
      <section className="bg-white-grid">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
          <div className="text-center mb-12">
            <div className="eyebrow">{text("faq.eyebrow")}</div>
            <h2 className="mt-4 text-3xl md:text-5xl font-bold tracking-tight text-ink">
              {text("faq.h2")}
            </h2>
            <p className="mt-3 text-ink-muted">
              {text("faq.sub")}
            </p>
          </div>
          <FaqAccordion />
        </div>
      </section>

      {/* SECTION 08 — Booking */}
      <section id="prenota" className="bg-blueprint scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
          <div className="text-center max-w-3xl mx-auto">
            <Eyebrow>{text("s08.eyebrow")}</Eyebrow>
            <h2 className="mt-4 text-3xl md:text-5xl font-bold tracking-tight">
              {text("s08.h2")}
            </h2>
            <p className="mt-4 text-base md:text-lg text-brand font-semibold">
              {text("s08.hook")}
            </p>
            <p className="mt-3 text-white/65">
              <RichText value={text("s08.body")} highlightClass="hl-nextgen" />
            </p>
            <p className="mt-2 text-white font-semibold">
              {text("s08.urgency")}
            </p>
          </div>

          <div className="mt-12 max-w-md mx-auto">
            <div className="bg-brand text-brand-foreground px-5 py-2.5 flex items-center justify-between text-[0.65rem] tracking-widest uppercase font-semibold rounded-t-sm">
              <span>{text("s08.priceLabel")}</span>
              <span>Ultimi {daysLeft} giorni</span>
            </div>
            <div className="bg-navy/60 border border-white/10 border-t-0 rounded-b-sm px-5 py-8 text-center">
              <div className="flex items-baseline justify-center gap-3">
                <span className="text-3xl text-white/30 line-through">47€</span>
                <span className="hl-nextgen text-5xl md:text-6xl font-extrabold tracking-tight">
                  GRATIS
                </span>
              </div>
              <div className="mt-3 text-[0.7rem] tracking-[0.22em] uppercase text-white/65">
                Accesso diretto · Oggi
              </div>
              <div className="mt-6 border-t border-white/10 pt-5 text-sm text-white/65">
                Slot <span className="hl-nextgen">gratuiti</span> per <span className="text-white">{month}</span>.
                <br />
                Dal 1° <span className="text-white">{nextMonth}</span> torna a{" "}
                <span className="line-through">47€</span>.
              </div>
            </div>
          </div>

          <div className="mt-10 max-w-md mx-auto">
            <BookingFunnel variant="dark" />
          </div>

          <div className="mt-10 text-center text-[0.7rem] tracking-[0.22em] uppercase text-white/65">
            <RichText value={text("s08.cta")} highlightClass="hl-nextgen" />
          </div>

        </div>
      </section>

      {/* SLOGAN */}
      <section className="bg-white-grid border-t border-ink/10">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-20 lg:py-28 text-center">
          <div className="eyebrow text-[0.7rem] flex items-center gap-2 justify-center text-brand">
            {text("slogan.eyebrow")}
          </div>
          <h2 className="mt-6 text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] text-ink">
            <RichText value={text("slogan.h2")} highlightClass="text-brand" />
          </h2>
          <p className="mt-6 text-ink-muted text-sm md:text-base tracking-wide max-w-xl mx-auto">
            {text("slogan.body")}
          </p>
        </div>
      </section>

      <Footer />
      <CookieBanner />
    </main>
  );
}
