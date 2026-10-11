// Logo del brand: caricato dall'app (Storage) e salvato in app_config.
// Se non impostato, fallback al testo. Nessuna immagine rotta.
import { useEffect, useState } from "react";

let cachedUrl: string | null | undefined; // cache per sessione

export function BrandLogo({ className = "h-7 w-auto" }: { className?: string }) {
  const [state, setState] = useState<"loading" | "img" | "text">(cachedUrl ? "img" : cachedUrl === "" ? "text" : "loading");
  const [url, setUrl] = useState<string>(cachedUrl || "");

  useEffect(() => {
    if (cachedUrl !== undefined) return;
    fetch("/api/presenter/brand")
      .then((r) => r.json())
      .then((j) => {
        cachedUrl = j.logoUrl || "";
        if (j.logoUrl) { setUrl(j.logoUrl); setState("img"); } else setState("text");
      })
      .catch(() => { cachedUrl = ""; setState("text"); });
  }, []);

  if (state === "loading") return <span className={`inline-block ${className}`} aria-hidden />;
  if (state === "img" && url) return <img src={url} alt="Hair Genius Labs" onError={() => setState("text")} className={`${className} object-contain`} />;
  return <span className="text-sm font-semibold tracking-tight text-white">Hair Genius <span className="text-brand">Labs</span></span>;
}
