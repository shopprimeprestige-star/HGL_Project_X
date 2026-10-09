import { useState } from "react";
import { Star, Play, ShieldCheck } from "lucide-react";
import { useLandingContent, type Review } from "@/landing/landing-content";

function Stars({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < n ? "fill-brand text-brand" : "text-white/20"}`}
          strokeWidth={1.5}
        />
      ))}
      <span className="ml-1.5 text-[0.7rem] tracking-widest uppercase text-white/55 font-semibold">
        {n.toFixed(1)}
      </span>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const [playing, setPlaying] = useState(false);
  return (
    <article className="group relative bg-navy/60 border border-white/10 hover:border-brand/40 transition-colors rounded-sm overflow-hidden flex flex-col">
      {/* Video / poster */}
      <div className="relative aspect-[4/5] bg-navy-light overflow-hidden">
        {review.videoUrl ? (
          <video
            className="absolute inset-0 w-full h-full object-cover"
            src={review.videoUrl}
            poster={review.posterUrl || undefined}
            controls={playing}
            playsInline
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        ) : review.posterUrl ? (
          <img
            src={review.posterUrl}
            alt={review.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy-light to-navy grid place-items-center">
            <span className="text-[0.7rem] tracking-[0.22em] uppercase text-white/35">
              Video recensione
            </span>
          </div>
        )}

        {!playing && (
          <button
            type="button"
            aria-label="Play"
            onClick={(e) => {
              e.preventDefault();
              const v = (e.currentTarget.parentElement?.querySelector(
                "video",
              ) as HTMLVideoElement | null);
              if (v) {
                v.play();
                setPlaying(true);
              }
            }}
            className="absolute inset-0 grid place-items-center bg-navy/30 hover:bg-navy/10 transition-colors"
          >
            <span className="grid place-items-center w-16 h-16 rounded-full bg-brand text-brand-foreground shadow-[0_10px_30px_-6px_color-mix(in_oklab,var(--brand)_60%,transparent)] group-hover:scale-110 transition-transform">
              <Play className="h-6 w-6 ml-0.5" fill="currentColor" strokeWidth={0} />
            </span>
          </button>
        )}

        <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-brand text-brand-foreground text-[0.6rem] tracking-[0.22em] uppercase font-bold px-2.5 py-1 rounded-sm shine">
          <ShieldCheck className="h-3 w-3" strokeWidth={2.5} /> Verificato
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-white font-semibold text-sm">{review.name}</div>
            <div className="text-[0.65rem] tracking-[0.22em] uppercase text-white/50 mt-0.5">
              Cliente verificato
            </div>
          </div>
          <Stars n={review.rating} />
        </div>
        <h3 className="text-base font-bold text-white leading-snug tracking-tight">
          {review.title}
        </h3>
        <p className="text-sm text-white/65 leading-relaxed border-l-2 border-brand/60 pl-3">
          {review.text}
        </p>
      </div>
    </article>
  );
}

export function VideoReviewsSection() {
  const { content } = useLandingContent();
  return (
    <section className="bg-blueprint" id="recensioni">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-sm border border-brand/40 bg-brand/10 text-brand text-[0.6rem] tracking-[0.28em] uppercase font-bold">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
            {content.reviewsBadge}
          </div>
          <h2 className="mt-5 text-3xl md:text-5xl font-bold tracking-tight leading-[1.05]">
            {content.reviewsHeadline}
          </h2>
          <p className="mt-4 text-white/65">
            {content.reviewsCount} · {content.reviewsSubhead}
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {content.reviews.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      </div>
    </section>
  );
}
