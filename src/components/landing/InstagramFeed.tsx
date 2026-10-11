import { Instagram, Heart, MessageCircle, ExternalLink } from "lucide-react";
import { PlaceholderBox } from "./PlaceholderBox";

const PROFILE = {
  handle: "hairgeniuslabs.hair",
  url: "https://www.instagram.com/hairgeniuslabs.hair/",
  name: "Hair Genius Labs",
  followers: "12.4K",
  following: "284",
  posts: "147",
  bio: "Bio-Mimetic™ · Impianto di grado clinico\nIndistinguibile dalla cute · Milano 🇮🇹",
};

const POSTS = [
  { likes: "1.2K", comments: "84" },
  { likes: "892", comments: "47" },
  { likes: "2.1K", comments: "156" },
  { likes: "743", comments: "32" },
  { likes: "1.8K", comments: "112" },
  { likes: "956", comments: "61" },
];

export function InstagramFeed() {
  return (
    <section className="bg-white-trama">
      <div className="max-w-5xl mx-auto px-6 lg:px-10 py-20 lg:py-24">
        {/* Header card */}
        <div className="bg-white border border-ink/10 rounded-sm shadow-sm overflow-hidden">
          <div className="px-6 py-6 sm:px-8 sm:py-7 flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-7">
            {/* Avatar */}
            <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-full p-[3px] bg-gradient-to-tr from-brand via-fuchsia-500 to-amber-400">
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                <Instagram className="h-8 w-8 text-brand" strokeWidth={1.5} />
              </div>
            </div>

            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <a
                  href={PROFILE.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg font-semibold text-ink hover:text-brand inline-flex items-center justify-center sm:justify-start gap-1.5"
                >
                  @{PROFILE.handle}
                  <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                </a>
                <a
                  href={PROFILE.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 bg-brand text-brand-foreground text-[0.7rem] tracking-widest uppercase font-semibold px-3.5 py-1.5 rounded-sm hover:bg-brand/90 transition-colors w-fit mx-auto sm:mx-0"
                >
                  Segui
                </a>
              </div>

              <div className="mt-4 flex items-center justify-center sm:justify-start gap-6 text-sm">
                <div>
                  <span className="font-bold text-ink">{PROFILE.posts}</span>{" "}
                  <span className="text-ink-muted">post</span>
                </div>
                <div>
                  <span className="font-bold text-ink">{PROFILE.followers}</span>{" "}
                  <span className="text-ink-muted">follower</span>
                </div>
                <div>
                  <span className="font-bold text-ink">{PROFILE.following}</span>{" "}
                  <span className="text-ink-muted">seguiti</span>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-sm font-semibold text-ink">{PROFILE.name}</div>
                <p className="text-sm text-ink-muted whitespace-pre-line leading-relaxed">
                  {PROFILE.bio}
                </p>
              </div>
            </div>
          </div>

          {/* Posts grid */}
          <div className="border-t border-ink/10 grid grid-cols-3 gap-px bg-ink/5">
            {POSTS.map((p, i) => (
              <a
                key={i}
                href={PROFILE.url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative aspect-square bg-white group overflow-hidden"
              >
                <PlaceholderBox
                  light={false}
                  caption=""
                  className="absolute inset-0 !min-h-0 !rounded-none border-0"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/55 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex items-center gap-4 text-white text-sm font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <Heart className="h-4 w-4 fill-white" /> {p.likes}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MessageCircle className="h-4 w-4 fill-white" /> {p.comments}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>

          <div className="border-t border-ink/10 px-6 py-4 text-center">
            <a
              href={PROFILE.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[0.7rem] tracking-[0.22em] uppercase font-semibold text-brand hover:text-brand/80"
            >
              <Instagram className="h-4 w-4" />
              Vedi tutti i post su Instagram
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
