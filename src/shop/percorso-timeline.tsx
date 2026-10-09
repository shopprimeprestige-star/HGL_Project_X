// Timeline condivisa del percorso impianto, usata sia dalla pagina /percorso
// sia dalla schermata "Il tuo percorso" dentro il preventivo creato.
//
// Chi legge è il cliente, da solo, spesso la sera, dal telefono, senza il
// consulente accanto. Perciò il testo risponde sempre a tre domande, in
// quest'ordine: A CHE PUNTO SONO · DEVO FARE QUALCOSA IO O ASPETTO · QUANDO
// (come data, non come conto sul calendario da fare a mente).
import { Camera, Video, Palette, Factory, Wrench, Check, Clock, CalendarCheck, Hourglass } from "lucide-react";

/* ── tempistiche (giorni dalla data di inizio) — INVARIATE ── */
export const DESIGN_MIN = 20, DESIGN_MAX = 25;   // progettazione attaccatura
export const PROD_MIN = 30, PROD_MAX = 35;       // produzione

export type StepKey = "selfie" | "video" | "colore" | "produzione" | "installazione";
export interface Steps { selfie?: boolean; video?: boolean; colore?: boolean; produzione?: boolean; installazione?: boolean }

export const fmtDate = (d: Date) => d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
/** versione compatta (senza anno) per le righe di riepilogo strette */
const fmtShort = (d: Date) => d.toLocaleDateString("it-IT", { day: "numeric", month: "long" });
const addDays = (from: Date, n: number) => { const d = new Date(from); d.setDate(d.getDate() + n); return d; };
/** i dati veri non rispettano i tipi: `start` può essere null, o un Date nato da
 *  `new Date(undefined)`. In quel caso il percorso deve funzionare lo stesso,
 *  mostrando le durate: mai una data sbagliata, mai "Invalid Date". */
const safeDate = (d: Date | null | undefined): Date | null =>
  d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;

/** ── PERCORSO DEL TRAPIANTO ────────────────────────────────────────────────
 *  Il trapianto non segue il percorso dell'impianto (selfie, produzione,
 *  installazione): è un viaggio di 5 giorni. Qui l'itinerario reale, giorno per
 *  giorno, così il cliente sa esattamente cosa lo aspetta. */
const TX_DAYS = [
  { n: "Giorno 1", title: "Arrivo e visita medica", body: "Trasferimento dall'aeroporto e sistemazione in hotel. Nel pomeriggio visita in clinica: analisi dell'area donatrice, disegno dell'attaccatura e scelta della tecnica (FUE Zaffiro o DHI) insieme al medico." },
  { n: "Giorno 2", title: "Trapianto", body: "L'intervento occupa l'intera giornata, in anestesia locale. Al termine, prima medicazione e istruzioni per la notte." },
  { n: "Giorno 3", title: "Riposo e primo controllo", body: "Giornata di riposo con controllo della zona trapiantata e indicazioni su come dormire e muoversi nei giorni successivi." },
  { n: "Giorno 4", title: "Recupero assistito", body: "Riposo, idratazione e monitoraggio. Restiamo a disposizione per qualunque necessità." },
  { n: "Giorno 5", title: "Controlli e primo lavaggio", body: "Controllo finale in clinica, primo lavaggio eseguito dal personale, consegna del protocollo post-trapianto e rientro." },
];

export function TransplantTimeline() {
  return (
    <div>
      <div data-hg-anchor="percorso-mappa" className="mb-6 rounded-2xl border border-brand/25 bg-brand/[0.06] px-4 py-4 text-sm text-white/75">
        <p className="font-semibold text-white">Cinque giorni a Istanbul, organizzati da noi.</p>
        <p className="mt-1 text-[13px] leading-relaxed">
          Hotel incluso per <b className="text-white">due persone</b> — tu e un accompagnatore — con trasferimenti da e per la clinica.
          Il <b className="text-white">volo è a carico tuo</b>. La clinica è nostra affiliata e opera con tecniche FUE Zaffiro e DHI (Choi).
        </p>
      </div>
      <div className="relative space-y-4">
        <div className="absolute left-[27px] top-4 bottom-4 hidden w-px bg-white/10 sm:block" />
        {TX_DAYS.map((d, i) => (
          <section key={d.n} data-hg-anchor={`percorso-tx-${i + 1}`} className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex gap-4">
              <span className="relative z-10 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
                <CalendarCheck className="h-6 w-6" strokeWidth={1.6} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold uppercase tracking-wide text-brand">{d.n}</div>
                <h3 className="mt-0.5 text-lg font-semibold text-white">{d.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/65">{d.body}</p>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ── PERCORSO DELL'IMPIANTO ───────────────────────────────────────────────── */

type Actor = "tu" | "noi" | "insieme";

/** Etichetta che risponde alla domanda più importante di tutte:
 *  in questo passo devo muovermi io, oppure aspetto? */
const ACTOR: Record<Actor, { label: string; cls: string }> = {
  tu: { label: "Tocca a te", cls: "border-amber-400/40 bg-amber-400/10 text-amber-200" },
  noi: { label: "Ci pensiamo noi", cls: "border-white/15 bg-white/[0.06] text-white/60" },
  insieme: { label: "Ci vediamo di persona", cls: "border-brand/45 bg-brand/15 text-brand" },
};

const ORDER: StepKey[] = ["selfie", "video", "colore", "produzione", "installazione"];

export function PercorsoTimeline({ start, steps }: { start: Date | null; steps: Steps }) {
  const from = safeDate(start);
  const dates = from
    ? {
        start: from,
        designFrom: addDays(from, DESIGN_MIN), designTo: addDays(from, DESIGN_MAX),
        prodFrom: addDays(from, DESIGN_MIN + PROD_MIN), prodTo: addDays(from, DESIGN_MAX + PROD_MAX),
      }
    : null;

  // i passi possono arrivare vuoti, null, o non essere affatto un oggetto
  const done: Steps = steps && typeof steps === "object" ? steps : {};
  const current = ORDER.find((k) => !done[k]) ?? null;

  const ROWS: {
    key: StepKey; n: number; icon: typeof Camera; actor: Actor;
    title: string; lead: string; body: string;
    when: string; whenNote?: string;
    waitAfter?: { how: string; what: string };
  }[] = [
    {
      key: "selfie", n: 1, icon: Camera, actor: "tu",
      title: "Tu ci mandi un selfie",
      lead: "Un selfie frontale del viso, e ce lo mandi. È tutto quello che serve per partire.",
      body: "Da lì analizziamo la forma e le proporzioni del tuo viso e disegniamo la tua attaccatura personalizzata.",
      when: dates ? `${fmtDate(dates.start)} — il percorso parte da qui` : "Adesso: è il primo passo",
      waitAfter: {
        how: `${DESIGN_MIN}–${DESIGN_MAX} giorni`,
        what: "Progettiamo la tua attaccatura. In questo tempo tu non devi fare nulla: quando è pronta ti scriviamo noi.",
      },
    },
    {
      key: "video", n: 2, icon: Video, actor: "tu",
      title: "Tu ci mandi un video 360°",
      lead: "Un video girato lentamente attorno alla testa, con luce naturale, da inviarci su WhatsApp.",
      body: "Non devi ricordartene tu: te lo chiediamo noi quando l'attaccatura è pronta.",
      when: dates
        ? `Fra il ${fmtDate(dates.designFrom)} e il ${fmtDate(dates.designTo)}`
        : `${DESIGN_MIN}–${DESIGN_MAX} giorni dopo il selfie`,
      whenNote: "Ti avvisiamo noi quando è il momento.",
    },
    {
      key: "colore", n: 3, icon: Palette, actor: "noi",
      title: "Noi analizziamo il colore",
      lead: "Dal tuo video ricaviamo il codice colore esatto del tuo impianto.",
      body: "Individuiamo tonalità, riflessi e percentuale di brizzolatura. Tu non devi fare nulla.",
      when: "Appena riceviamo il tuo video",
      whenNote: "Non aggiunge attesa: si incastra fra il video e l'inizio della produzione.",
    },
    {
      key: "produzione", n: 4, icon: Factory, actor: "noi",
      title: "Noi produciamo il tuo impianto",
      lead: "Ora abbiamo tutto: attaccatura, forma del viso e colore. Inizia la produzione.",
      body: "Il tuo impianto viene costruito su misura, solo per te. Anche qui tu aspetti e basta.",
      // niente data qui: la data di arrivo è una sola e sta nell'ultimo passo.
      // Due riquadri con la stessa finestra fanno solo dubitare che siano due momenti diversi.
      when: `${PROD_MIN}–${PROD_MAX} giorni di lavorazione`,
      whenNote: "È il tratto più lungo del percorso: finisce alla data del passo 5, qui sotto.",
    },
    {
      key: "installazione", n: 5, icon: Wrench, actor: "insieme",
      title: "Ci vediamo: installazione",
      lead: "Quando il tuo impianto è pronto fissiamo insieme il giorno, e lo indossi.",
      body: "Meno di 2 ore · tutto in un solo giorno · dal lunedì alla domenica, all'orario che preferisci, su appuntamento.",
      when: dates
        ? `Fra il ${fmtDate(dates.prodFrom)} e il ${fmtDate(dates.prodTo)}`
        : `Circa ${DESIGN_MIN + PROD_MIN}–${DESIGN_MAX + PROD_MAX} giorni dall'inizio`,
      whenNote: "In quei giorni il tuo impianto è pronto: il giorno preciso lo scegli tu.",
    },
  ];

  const currentRow = ROWS.find((r) => r.key === current) ?? null;

  return (
    <div>
      {/* ── A CHE PUNTO SEI ───────────────────────────────────────────────
          Non ripete i cinque passi (si leggono subito sotto): dice l'unica
          cosa che l'elenco non può dire, cioè dove sei arrivato e se in
          questo momento la palla è tua o nostra. */}
      <section data-hg-anchor="percorso-mappa" className="mb-6 rounded-2xl border border-brand/30 bg-brand/[0.07] p-4 sm:p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">A che punto sei</p>

        {currentRow ? (
          <>
            <p className="mt-2 text-lg font-semibold leading-tight text-white">
              Passo {currentRow.n} di 5 · {currentRow.title}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-white/70">
              {currentRow.actor === "tu"
                ? "Adesso la palla è tua: finché non ci arriva quello che serve, il percorso resta fermo qui."
                : currentRow.actor === "noi"
                  ? "Adesso stiamo lavorando noi. Tu non devi fare nulla: ti scriviamo appena è di nuovo il tuo turno."
                  : "Manca solo l'ultimo passo: ci vediamo di persona."}
            </p>
          </>
        ) : (
          <p className="mt-2 text-lg font-semibold text-white">Percorso completato. Ci sei arrivato.</p>
        )}

        {/* pallini di avanzamento: fatti · qui · da fare */}
        <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          {ROWS.map((r, i) => {
            const isDone = !!done[r.key];
            const isCur = current === r.key;
            return (
              <span key={r.key} className={`flex items-center gap-1.5 ${i < ROWS.length - 1 ? "flex-1" : "flex-none"}`}>
                <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  isDone ? "bg-emerald-500/25 text-emerald-300" : isCur ? "bg-brand text-white ring-4 ring-brand/25" : "bg-white/[0.07] text-white/40"
                }`}>
                  {isDone ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : r.n}
                </span>
                {i < ROWS.length - 1 && <span className={`h-px flex-1 ${isDone ? "bg-emerald-500/35" : "bg-white/10"}`} />}
              </span>
            );
          })}
        </div>

        {/* la riga sulle date indicative sta QUI, una volta sola per tutta la pagina */}
        <p className="mt-4 border-t border-white/10 pt-3 text-[12px] leading-relaxed text-white/60">
          {dates ? (
            <>
              Le date che vedi sotto sono <b className="text-white/85">indicative</b> e valgono per tutto il percorso: te le confermiamo passo per passo.
              {" "}Si finisce fra il <b className="text-white">{fmtShort(dates.prodFrom)}</b> e il <b className="text-white">{fmtShort(dates.prodTo)}</b>, con l'installazione.
            </>
          ) : (
            <>Le durate qui sotto sono <b className="text-white/85">indicative</b>. Le date esatte compaiono qui appena il percorso parte dal tuo selfie.</>
          )}
        </p>
      </section>

      {/* ── I CINQUE PASSI ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        {ROWS.map((s) => {
          const isDone = !!done[s.key];
          const isCurrent = current === s.key;
          const isFinal = s.key === "installazione";
          const Icon = s.icon;

          return (
            <div key={s.key}>
              <section
                data-hg-anchor={`percorso-step-${s.key}`}
                className={`relative rounded-2xl border p-4 transition print:break-inside-avoid sm:p-5 ${
                  isFinal
                    ? "border-brand/60 bg-gradient-to-br from-brand/20 to-brand/[0.04] ring-1 ring-brand/25"
                    : isCurrent
                      ? "border-brand bg-brand/[0.09]"
                      : isDone
                        ? "border-emerald-500/30 bg-emerald-500/[0.05]"
                        : "border-white/10 bg-white/[0.03]"
                }`}
              >
                {isFinal && (
                  <p className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                    isDone ? "bg-emerald-500/20 text-emerald-300" : "bg-brand/20 text-brand"
                  }`}>
                    {isDone ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : <CalendarCheck className="h-3.5 w-3.5" />}
                    {isDone ? "Traguardo raggiunto" : "Il traguardo"}
                  </p>
                )}

                <div className="flex items-start gap-3 sm:gap-4">
                  <span className={`flex flex-shrink-0 items-center justify-center rounded-xl ${isFinal ? "h-14 w-14 bg-brand text-white sm:h-16 sm:w-16" : "h-12 w-12 sm:h-14 sm:w-14"} ${
                    isFinal ? "" : isDone ? "bg-emerald-500/15 text-emerald-400" : isCurrent ? "bg-brand text-white" : "bg-white/[0.06] text-white/45"
                  }`}>
                    {isDone ? <Check className={isFinal ? "h-7 w-7" : "h-6 w-6"} strokeWidth={1.8} /> : <Icon className={isFinal ? "h-7 w-7" : "h-6 w-6"} strokeWidth={1.6} />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Passo {s.n} di 5</span>
                      {isDone ? (
                        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">Fatto</span>
                      ) : (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ACTOR[s.actor].cls}`}>{ACTOR[s.actor].label}</span>
                      )}
                      {isCurrent && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Sei qui</span>}
                    </div>

                    <h2 className={`mt-1 font-semibold text-white ${isFinal ? "text-xl sm:text-2xl" : "text-lg"}`}>{s.title}</h2>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-white/85">{s.lead}</p>
                    <p data-hg-anchor={`percorso-step-${s.key}-testo`} className="mt-1 text-sm leading-relaxed text-white/55">{s.body}</p>

                    {/* QUANDO — stesso posto in tutti i passi, così nessuno sembra dimenticato */}
                    <div className={`mt-3 flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${
                      isFinal ? "border-white/20 bg-white/[0.10]" : "border-white/10 bg-white/[0.04]"
                    }`}>
                      <CalendarCheck className={`mt-0.5 h-4 w-4 flex-shrink-0 ${isFinal || isCurrent ? "text-brand" : "text-white/40"}`} />
                      <div className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/45">Quando</span>
                        <span className={`block font-semibold text-white ${isFinal ? "text-base sm:text-lg" : "text-sm"}`}>{s.when}</span>
                        {s.whenNote && <span className="mt-0.5 block text-xs leading-relaxed text-white/50">{s.whenNote}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── ATTESA fra un passo e l'altro ────────────────────────
                  La durata sta qui, dove il tempo passa davvero; le date
                  stanno nei passi. Così è chiaro quale delle due comanda. */}
              {s.waitAfter && (
                <div className="flex items-start gap-3 px-4 py-3 sm:gap-4 sm:px-5">
                  <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center sm:h-14 sm:w-14">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-white/20 text-white/40">
                      <Hourglass className="h-4 w-4" strokeWidth={1.6} />
                    </span>
                  </span>
                  <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-white/50">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-white/75">
                      <Clock className="h-3.5 w-3.5" /> {s.waitAfter.how} di attesa
                    </span>
                    <span className="mt-0.5 block">{s.waitAfter.what}</span>
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
