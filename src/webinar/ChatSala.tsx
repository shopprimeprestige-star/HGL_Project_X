/** ── LA CHAT DELLA SALA ─────────────────────────────────────────────────────
 *  Una sola volta, usata da due parti: la sala degli spettatori e la regia del
 *  presentatore. Cambia chi può fare cosa (`comandi`), non come si legge: una
 *  chat che al presentatore appare diversa da come la vedono gli altri è una
 *  chat in cui si modera al buio.
 */
import { useEffect, useRef } from "react";
import { CornerDownRight, Hand, MessageSquare, Mic, MicOff, Pin, Radio, Trash2, Video } from "lucide-react";
import type { InPalco, MessaggioChat } from "./tipi";
import { sciogli, tono } from "./menzioni";

/** I gesti che solo il presentatore ha. Assenti = sola lettura. */
export interface ComandiChat {
  /** tocca il nome di chi ha scritto: si apre il pannello con tutto quello che
   *  si può fare a quella persona */
  apriPersona?: (spettatore: string, nome: string) => void;
  /** fa salire chi ha scritto: voce sola, oppure voce e faccia */
  faiSalire: (spettatore: string, nome: string, modo: "audio" | "video") => void;
  faiScendere: (spettatore: string) => void;
  microfono: (spettatore: string, acceso: boolean) => void;
  fissa: (id: string, acceso: boolean) => void;
  cancella: (id: string) => void;
}

const COLORE: Record<MessaggioChat["ruolo"], string> = {
  //  Tre colori e tre soli: chi conduce, chi ha la parola, tutti gli altri.
  //  Un colore per persona sarebbe illeggibile a cinquanta messaggi al minuto.
  presentatore: "border-l-2 border-sky-400 bg-sky-400/10",
  palco: "border-l-2 border-emerald-400 bg-emerald-400/10",
  ospite: "border-l-2 border-transparent",
};

export function ChatSala({
  messaggi,
  palco,
  comandi,
  ioSpettatore,
  mioNome,
  onRispondi,
  className,
}: {
  messaggi: MessaggioChat[];
  palco: InPalco[];
  comandi?: ComandiChat;
  /** il proprio identificativo, per riconoscere i propri messaggi */
  ioSpettatore?: string;
  /** ── ⚠️ IL PROPRIO NOME, E SERVE DAVVERO ────────────────────────────────
   *  Nella sala pubblica i messaggi NON portano l'identificativo di chi li ha
   *  scritti: è tolto apposta dalla risposta (vedi MessaggioChat.spettatoreId),
   *  perché agli spettatori non serve sapere chi è chi. Conseguenza che non
   *  avevo previsto: senza quell'identificativo la sala non riconosce nemmeno i
   *  PROPRI messaggi, e me li disegnava tutti a sinistra come quelli degli
   *  altri — cioè la cosa che le bolle devono dire per prima.
   *  Il nome è l'unica cosa che la sala ha di sé stessa, e basta.
   *  ⚠️ Due persone con lo stesso nome si vedrebbero i messaggi dell'altra
   *   dalla parte sbagliata. È un difetto piccolo e senza conseguenze — nessuno
   *   legge niente che non fosse già pubblico — e l'alternativa era rimettere
   *   in circolo l'identificativo di tutti per risolverne uno estetico. */
  mioNome?: string;
  /** ⚠️ Assente = non si può rispondere. È il caso della console, dove chi
   *  conduce risponde a voce: un tasto «rispondi» accanto a ogni riga, lì,
   *  sarebbe un comando in più fra lui e i tre che contano. */
  onRispondi?: (a: { id: string; nome: string }) => void;
  className?: string;
}) {
  const fondo = useRef<HTMLDivElement | null>(null);
  const attaccato = useRef(true);
  /** Il conto alla rovescia del tocco lungo. Zero = nessun dito premuto. */
  const premuto = useRef<number>(0);

  //  ⚠️ SI SCENDE SOLO SE SI ERA GIÀ IN FONDO. Trascinare qualcuno in fondo
  //   mentre sta rileggendo un messaggio più su è il modo più sicuro di
  //   fargli chiudere la chat: durante una diretta arrivano decine di
  //   messaggi, e ogni volta gli si strapperebbe la pagina di mano.
  useEffect(() => {
    if (attaccato.current) fondo.current?.scrollIntoView({ block: "end" });
  }, [messaggi.length]);

  const suScorrimento = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    attaccato.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const perId = new Map(palco.map((p) => [p.spettatore, p]));
  //  Finché la conversazione è corta si spiega come si risponde; poi si smette.
  const primiMessaggi = messaggi.length <= 4;

  return (
    <div className={`flex min-h-0 flex-col ${className || ""}`}>
      <div onScroll={suScorrimento} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-2.5 py-3">
        {/* ── ⚠️ LA CHAT VUOTA ERA UN VUOTO DI NOVECENTO PUNTI ──────────────
              Una riga di testo appesa in cima e sotto il nulla: sembra una
              pagina che non ha finito di caricare, non una conversazione che
              deve ancora cominciare. La differenza fra le due, per chi guarda,
              è se resta o chiude.
             Adesso è centrata e dice cosa fare — che è l'unica cosa che serve
             in una chat vuota: qualcuno deve scrivere per primo, e quel
             qualcuno sei tu. */}
        {messaggi.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05]">
              <MessageSquare className="h-5 w-5 text-white/25" />
            </div>
            <div>
              <p className="sala-testo font-semibold text-white/70">Nessun messaggio</p>
              <p className="sala-piccolo mt-1 text-white/35">
                Scrivi tu il primo: le domande in chat le legge chi conduce.
              </p>
            </div>
          </div>
        )}
        {/* ══ I MESSAGGI, A BOLLE ═══════════════════════════════════════════
              ⚠️ ERANO RIGHE DI TESTO SU FONDO TRASPARENTE, tutte uguali e
               tutte allineate a sinistra: per capire dove finiva un messaggio e
               cominciava il successivo bisognava leggere i nomi. In una chat che
               scorre durante una diretta, questo vuol dire non seguirla.
              Una bolla ha un confine, e il LATO dice già chi ha scritto: i tuoi
              a destra, gli altri a sinistra. È la forma che hanno tutte le chat
              per una ragione — si legge senza leggere.
              ⚠️ I colori restano quelli del marchio: il blu per i tuoi (lo
               stesso dei comandi), il grigio-blu per gli altri, l'azzurro per
               chi conduce. Nessun verde WhatsApp: qui il verde vuol dire già
               un'altra cosa — che una persona sta parlando. */}
        {messaggi.map((m) => {
          const suPalco = m.ruolo === "palco";
          const mio = m.spettatoreId
            ? m.spettatoreId === ioSpettatore
            //  Senza identificativo (è il caso della sala) si va di nome: vedi
            //  la nota su `mioNome`.
            : !!mioNome && m.ruolo !== "presentatore"
              && m.autore.trim().toLowerCase() === mioNome.trim().toLowerCase();
          //  ── A CHI RISPONDE QUESTO MESSAGGIO ────────────────────────────
          const r = sciogli(m.testo);
          const t = tono({ aId: r.aId, autoreId: m.spettatoreId }, ioSpettatore || "");
          return (
            <div
              key={m.id}
              //  ⚠️ TENERE PREMUTO RISPONDE. Sul telefono non esiste il
              //   passaggio del mouse, e il tasto «Rispondi» compariva solo
              //   passandoci sopra: da un telefono la funzione non c'era. Mezzo
              //   secondo distingue un tocco lungo da uno scorrimento — sotto,
              //   si risponderebbe a qualcuno ogni volta che si scorre.
              onPointerDown={onRispondi && m.spettatoreId && !mio
                ? (e) => {
                    if (e.pointerType === "mouse") return; // col mouse c'è il tasto
                    premuto.current = window.setTimeout(() => {
                      onRispondi({ id: m.spettatoreId!, nome: m.autore });
                      try { navigator.vibrate?.(12); } catch { /* non tutti l'hanno */ }
                    }, 500);
                  }
                : undefined}
              onPointerUp={() => { if (premuto.current) { clearTimeout(premuto.current); premuto.current = 0; } }}
              onPointerCancel={() => { if (premuto.current) { clearTimeout(premuto.current); premuto.current = 0; } }}
              onPointerMove={() => { if (premuto.current) { clearTimeout(premuto.current); premuto.current = 0; } }}
              className={`group flex select-none gap-2 sm:select-auto ${mio ? "flex-row-reverse" : "flex-row"}`}
            >
              {/*  ⚠️ L'INIZIALE SOLO SUI MESSAGGI DEGLI ALTRI. Sul proprio non
                    serve: sei tu, e il lato lo dice già. È la stessa scelta che
                    fanno tutte le chat, e libera spazio dove serve. */}
              {!mio && (
                <span
                  className={`sala-piccolo mt-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-bold ${
                    m.ruolo === "presentatore"
                      ? "bg-sky-500/25 text-sky-200"
                      : suPalco
                        ? "bg-emerald-500/25 text-emerald-200"
                        : "bg-white/[0.09] text-white/55"
                  }`}
                >
                  {(m.autore || "?").trim().charAt(0).toUpperCase()}
                </span>
              )}

              <div className={`flex min-w-0 max-w-[82%] flex-col ${mio ? "items-end" : "items-start"}`}>
                {/*  Il nome solo sugli altri, e solo fuori dalla bolla: dentro
                      ruberebbe la riga al messaggio, che è quello che si legge. */}
                {!mio && (
                  <div className="mb-0.5 flex items-center gap-1.5 pl-1">
                    {onRispondi && m.spettatoreId ? (
                      <button
                        type="button"
                        onClick={() => onRispondi({ id: m.spettatoreId!, nome: m.autore })}
                        className={`sala-piccolo font-semibold underline-offset-2 hover:underline ${
                          m.ruolo === "presentatore" ? "text-sky-300" : suPalco ? "text-emerald-300" : "text-white/55"
                        }`}
                      >
                        {m.autore}
                      </button>
                    ) : comandi?.apriPersona && m.spettatoreId ? (
                      <button
                        type="button"
                        onClick={() => comandi.apriPersona!(m.spettatoreId!, m.autore)}
                        title={`Cosa fare con ${m.autore}`}
                        className={`sala-piccolo font-semibold underline-offset-2 hover:underline ${
                          m.ruolo === "presentatore" ? "text-sky-300" : suPalco ? "text-emerald-300" : "text-white/55"
                        }`}
                      >
                        {m.autore}
                      </button>
                    ) : (
                      <span
                        className={`sala-piccolo font-semibold ${
                          m.ruolo === "presentatore" ? "text-sky-300" : suPalco ? "text-emerald-300" : "text-white/55"
                        }`}
                      >
                        {m.autore}
                      </span>
                    )}

                    {m.ruolo === "presentatore" && (
                      <span className="sala-micro uppercase tracking-wide rounded bg-sky-400/20 px-1.5 py-0.5 text-sky-200">Relatore</span>
                    )}

                    {/*  ⚠️ «ORA IN LIVE» distingue una domanda scritta da chi in
                          questo momento sta parlando in sala — a cui si risponde
                          a voce — da una scritta da chi guarda e basta. */}
                    {suPalco && (
                      <span className="sala-micro uppercase tracking-wide inline-flex items-center gap-1 rounded bg-emerald-400/20 px-1.5 py-0.5 text-emerald-200">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-70" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        </span>
                        in live
                      </span>
                    )}

                    {suPalco && !!m.spettatoreId && perId.has(m.spettatoreId) && (
                      perId.get(m.spettatoreId)!.microfono
                        ? <Mic className={`h-3 w-3 ${perId.get(m.spettatoreId)!.parla ? "text-emerald-300" : "text-emerald-400/50"}`} />
                        : <MicOff className="h-3 w-3 text-white/25" />
                    )}
                    {m.fissato && <Pin className="h-3 w-3 text-amber-300" />}
                  </div>
                )}

                {/* ── LA BOLLA ──────────────────────────────────────────────
                      ⚠️ L'ANGOLO SQUADRATO dal lato di chi scrive: è quello che
                       fa leggere la bolla come «detta da lì». Quattro angoli
                       tondi uguali sono un riquadro, non un messaggio. */}
                <div
                  className={`min-w-0 px-3 py-2 shadow-sm ${
                    mio
                      ? "rounded-2xl rounded-br-md bg-blue-600 text-white"
                      : m.ruolo === "presentatore"
                        ? "rounded-2xl rounded-bl-md bg-sky-500/20 ring-1 ring-sky-400/30"
                        : "rounded-2xl rounded-bl-md bg-white/[0.09]"
                  } ${
                    /*  Rivolto A TE: è l'unico che deve fermare l'occhio, e
                        capita una volta ogni cento messaggi. */
                    t === "a-me" ? "ring-2 ring-brand" : ""
                  }`}
                >
                  {!!r.aId && (
                    <span
                      className={`sala-micro mb-1 inline-flex max-w-full items-center gap-1 rounded px-1.5 py-0.5 ${
                        mio ? "bg-white/20 text-white/85" : t === "a-me" ? "bg-brand/40 text-white" : "bg-white/10 text-white/50"
                      }`}
                    >
                      <CornerDownRight className="h-3 w-3 shrink-0" />
                      <span className="truncate">{t === "a-me" ? "a te" : r.aNome}</span>
                    </span>
                  )}

                  <p className="sala-testo whitespace-pre-wrap break-words">{r.testo}</p>
                </div>

                {/*  I gesti della regia stanno sotto la bolla e compaiono
                      passandoci sopra: sempre visibili sarebbero una fila di
                      pulsanti al posto di una conversazione. */}
                {comandi && (
                  <div className="mt-1 flex flex-wrap gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      onClick={() => comandi.fissa(m.id, !m.fissato)}
                      className="sala-micro inline-flex items-center gap-1 rounded-md bg-white/[0.08] px-2 py-1 transition hover:bg-white/15"
                    >
                      <Pin className="h-3 w-3" /> {m.fissato ? "Togli" : "Fissa"}
                    </button>
                    <button
                      onClick={() => comandi.cancella(m.id)}
                      className="sala-micro inline-flex items-center gap-1 rounded-md bg-white/[0.08] px-2 py-1 text-rose-200 transition hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-3 w-3" /> Cancella
                    </button>
                  </div>
                )}

                {onRispondi && !!m.spettatoreId && !mio && (
                  <>
                    {primiMessaggi && (
                      <span className="sala-micro uppercase tracking-wide mt-1 inline-flex items-center gap-1 normal-case tracking-normal text-white/30 sm:hidden">
                        <CornerDownRight className="h-3 w-3 animate-pulse" />
                        tieni premuto per rispondere
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onRispondi({ id: m.spettatoreId!, nome: m.autore })}
                      className="sala-micro mt-1 hidden items-center gap-1 rounded-md bg-white/[0.08] px-2 py-1 text-white/55 opacity-0 transition hover:bg-white/15 hover:text-white group-hover:opacity-100 focus:opacity-100 sm:inline-flex"
                    >
                      <CornerDownRight className="h-3 w-3" /> Rispondi
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div ref={fondo} />
      </div>
    </div>
  );
}

/** ── CHI STA PARLANDO, IN CIMA ─────────────────────────────────────────────
 *  L'elenco della sala mette sopra chi è in diretta. Non è un vezzo: durante
 *  una diretta l'unica domanda che ci si fa guardando l'elenco è «chi ha il
 *  microfono aperto adesso», e cercarlo in mezzo a duecento nomi in ordine di
 *  arrivo vuol dire non trovarlo. */
export function ElencoPalco({
  palco,
  comandi,
  className,
}: {
  palco: InPalco[];
  comandi?: Pick<ComandiChat, "faiSalire" | "faiScendere" | "microfono">;
  className?: string;
}) {
  const inDiretta = palco.filter((p) => p.stato !== "attesa");
  const inAttesa = palco.filter((p) => p.stato === "attesa");
  if (!palco.length) return null;

  return (
    <div className={`space-y-1 ${className || ""}`}>
      {inDiretta.map((p) => (
        <div key={p.spettatore} className="flex items-center gap-2 rounded-md bg-emerald-400/10 px-2 py-1.5">
          {/*  Il microfono si ILLUMINA mentre la persona parla: senza, in una
              sala con quattro ospiti non si capisce chi sta parlando, e si
              finisce per interrompere quello sbagliato. */}
          <Mic
            className={`h-3.5 w-3.5 transition ${
              !p.microfono ? "text-white/25" : p.parla ? "scale-110 text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.9)]" : "text-emerald-400/50"
            }`}
          />
          <span className="min-w-0 flex-1 truncate sala-piccolo font-medium text-emerald-100">{p.nome}</span>
          {p.stato === "video" && <Video className="h-3 w-3 text-emerald-400/60" />}
          <span className="rounded bg-emerald-400/20 px-1 py-0.5 sala-micro font-semibold uppercase text-emerald-200">live</span>
          {comandi && (
            <>
              <button onClick={() => comandi.microfono(p.spettatore, !p.microfono)} className="rounded p-1 hover:bg-white/10" aria-label="Apri o chiudi il microfono">
                {p.microfono ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
              </button>
              <button onClick={() => comandi.faiScendere(p.spettatore)} className="rounded p-1 text-rose-300 hover:bg-rose-500/10" aria-label="Fai scendere">
                <Trash2 className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      ))}

      {inAttesa.map((p) => (
        <div key={p.spettatore} className="flex items-center gap-2 rounded-md bg-white/[0.04] px-2 py-1.5">
          <Hand className="h-3.5 w-3.5 text-amber-300" />
          <span className="min-w-0 flex-1 truncate sala-piccolo text-white/70">{p.nome}</span>
          {comandi ? (
            <>
              <button onClick={() => comandi.faiSalire(p.spettatore, p.nome, "audio")} className="rounded border border-emerald-400/40 px-1.5 py-0.5 sala-micro text-emerald-200 hover:bg-emerald-400/10">
                <Mic className="mr-0.5 inline h-3 w-3" />voce
              </button>
              <button onClick={() => comandi.faiSalire(p.spettatore, p.nome, "video")} className="rounded border border-emerald-400/40 px-1.5 py-0.5 sala-micro text-emerald-200 hover:bg-emerald-400/10">
                <Video className="mr-0.5 inline h-3 w-3" />video
              </button>
              <button onClick={() => comandi.faiScendere(p.spettatore)} className="rounded p-1 text-white/40 hover:bg-white/10" aria-label="Rifiuta">
                <Trash2 className="h-3 w-3" />
              </button>
            </>
          ) : (
            <span className="sala-micro uppercase tracking-wide text-white/35">ha alzato la mano</span>
          )}
        </div>
      ))}

      {!inDiretta.length && !inAttesa.length && (
        <p className="px-2 py-3 text-center sala-piccolo text-white/30">
          <Radio className="mr-1 inline h-3 w-3" /> Nessuno sul palco
        </p>
      )}
    </div>
  );
}
