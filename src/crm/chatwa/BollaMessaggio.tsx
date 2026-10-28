import { useEffect, useState } from "react";
import { AlertCircle, Check, CheckCheck, ExternalLink, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { classificaTesto, type TestoClassificato } from "./media";
import type { BollaProps } from "./tipi";

/** ── LA BOLLA ─────────────────────────────────────────────────────────────
 *  Commessa 2026-10-28, T9. Un messaggio, a forma di WhatsApp.
 *  ⚠️ Il testo in entrata lo scrive il cliente: un link diventa lettore, anteprima
 *   o collegamento SOLO se `classificaTesto` (D14, R8) lo riconosce, e nel DOM
 *   va sempre `url.href` che ne torna, mai la stringa grezza. Niente HTML dal
 *   testo: sempre un nodo di testo. */

/** L'ora del messaggio (sempre HH:MM: i giorni li separa la conversazione). */
function ora(d: string): string {
  const data = new Date(d);
  return Number.isNaN(data.getTime())
    ? ""
    : data.toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Rome",
      });
}

/** Il tipo che il browser deve saper riprodurre, dall'estensione del file (già controllata da media.ts). */
function mimeAudio(url: string): string {
  const est = new URL(url).pathname.split(".").pop()?.toLowerCase();
  if (est === "mp3") return "audio/mpeg";
  if (est === "m4a") return "audio/mp4";
  if (est === "aac") return "audio/aac";
  if (est === "amr") return "audio/amr";
  return "audio/ogg; codecs=opus"; // ogg, oga, opus
}

/** Collegamento a un file ospitato da ManyChat: nuova scheda, senza passare l'origine del CRM. */
function Collegamento({ url, testo }: { url: string; testo: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 md:min-h-8 items-center gap-1.5 font-medium underline underline-offset-2"
    >
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {testo}
    </a>
  );
}

/** Il vocale: lettore se il browser sa riprodurlo (nessuna richiesta finché non si preme play), altrimenti il link. */
function Vocale({ url }: { url: string }) {
  const [riproducibile, setRiproducibile] = useState(true);
  useEffect(() => {
    // Safari iOS vecchi non suonano l'.ogg: lì resta solo il link (D14).
    if (document.createElement("audio").canPlayType(mimeAudio(url)) === "") setRiproducibile(false);
  }, [url]);
  return (
    <div className="flex flex-col gap-1.5">
      <span>🎤 Vocale</span>
      {riproducibile ? (
        <audio
          controls
          preload="none"
          src={url}
          onError={() => setRiproducibile(false)}
          className="h-10 w-64 max-w-full min-w-0"
        />
      ) : (
        <Collegamento url={url} testo="Apri il vocale" />
      )}
    </div>
  );
}

/** La foto: non si carica da sola. L'`<img>` esiste solo dopo il tocco (D14, R8). */
function Foto({ url }: { url: string }) {
  const [vista, setVista] = useState(false);
  const [guasta, setGuasta] = useState(false);
  if (guasta) {
    return (
      <div className="flex flex-col gap-1">
        <span>Foto non disponibile: il link potrebbe essere scaduto.</span>
        <Collegamento url={url} testo="Prova ad aprirla" />
      </div>
    );
  }
  if (!vista) {
    return (
      <button
        type="button"
        onClick={() => setVista(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-current/25 px-3 py-2 text-left font-medium"
      >
        <ImageIcon className="h-4 w-4 shrink-0" aria-hidden />
        📷 Foto · Tocca per vedere
      </button>
    );
  }
  return (
    <img
      src={url}
      alt="Foto inviata dal cliente"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setGuasta(true)}
      className="max-h-80 max-w-full rounded-lg object-contain"
    />
  );
}

/** Il contenuto: solo i messaggi IN ENTRATA si interpretano; quelli scritti da noi sono sempre testo. */
function Contenuto({ messaggio: m, c }: BollaProps & { c: TestoClassificato | null }) {
  if (!c || c.tipo === "testo") {
    return <p className="whitespace-pre-wrap break-words">{m.body}</p>;
  }
  if (c.tipo === "illeggibile") {
    return <p className="italic">{c.etichetta}</p>;
  }
  const url = c.url;
  if (!url) return <p className="whitespace-pre-wrap break-words">{m.body}</p>;
  if (c.tipo === "audio") return <Vocale url={url} />;
  if (c.tipo === "immagine") return <Foto url={url} />;
  const azione = {
    video: "Apri il video",
    documento: "Apri il documento",
    allegato: "Apri l'allegato",
  }[c.tipo];
  return (
    <div className="flex flex-col gap-0.5">
      <span>{c.etichetta}</span>
      <Collegamento url={url} testo={azione ?? "Apri"} />
    </div>
  );
}

/** Una bolla di messaggio. */
export function BollaMessaggio({ messaggio: m }: BollaProps) {
  const fromMe = m.direction === "outbound";
  const c = fromMe ? null : classificaTesto(m.body ?? "");
  const illeggibile = c?.tipo === "illeggibile";
  return (
    <div
      className={cn(
        "max-w-[85%] md:max-w-[75%] min-w-0 px-3 py-1.5 rounded-2xl text-[15px] md:text-[13px] leading-snug shadow-sm border",
        fromMe
          ? "self-end bg-emerald-100 text-emerald-950 border-emerald-200 rounded-br-sm"
          : illeggibile
            ? "self-start bg-muted text-muted-foreground border-border rounded-bl-sm"
            : "self-start bg-card text-foreground border-border rounded-bl-sm",
      )}
    >
      <Contenuto messaggio={m} c={c} />
      <div
        className={cn(
          "flex items-center justify-end gap-1 mt-0.5 text-[11px]",
          fromMe ? "text-emerald-900/80" : "text-muted-foreground",
        )}
      >
        <span>{ora(m.created_at)}</span>
        {fromMe && m.status === "read" && (
          <CheckCheck className="h-3.5 w-3.5 text-sky-600" aria-label="Letto" />
        )}
        {fromMe && m.status === "delivered" && (
          <CheckCheck className="h-3.5 w-3.5" aria-label="Consegnato" />
        )}
        {fromMe && (m.status === "sent" || m.status === "queued") && (
          <Check className="h-3.5 w-3.5" aria-label="Inviato" />
        )}
        {fromMe && m.status === "failed" && (
          <AlertCircle
            className="h-3.5 w-3.5 text-rose-600"
            aria-label={m.error_message ? `Non inviato: ${m.error_message}` : "Non inviato"}
          />
        )}
      </div>
    </div>
  );
}
