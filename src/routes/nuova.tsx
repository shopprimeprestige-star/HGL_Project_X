/** ── LA LANDING «2035» ─────────────────────────────────────────────────────
 *  /nuova
 *
 *  Rifacimento del sito storico (hairgeniuslabs.hair) con un obiettivo solo:
 *  far arrivare più persone al modulo di prenotazione. Il contenuto è quello —
 *  installazione in meno di due ore, niente chirurgia, mille recensioni vere —
 *  ma detto in meno parole e nell'ordine in cui una persona se le chiede.
 *
 *  ── ⚠️ IL MODULO È QUELLO CHE C'È GIÀ, NON UNO NUOVO ─────────────────────
 *  `BookingFunnel` è il modulo ottimizzato della landing attuale: calendario,
 *  qualifica, contatti, tracciamento. Riscriverne un altro qui vorrebbe dire
 *  due moduli da tenere allineati e, soprattutto, buttare via mesi di
 *  misurazioni. Cambia il vestito attorno; il punto in cui si converte no.
 *
 *  ── ⚠️ DUE AZIONI NEL PRIMO SCHERMO, E NON SONO PARI ─────────────────────
 *  La principale resta la consulenza (è quella che vale). L'anteprima capelli
 *  è la seconda: serve a chi non è pronto a lasciare il numero — si guarda
 *  allo specchio con i capelli, e da lì la consulenza non è più un salto nel
 *  buio. Metterle allo stesso peso le avrebbe messe in concorrenza.
 *
 *  ── ⚠️ LE FOTOGRAFIE SONO LE LORO ────────────────────────────────────────
 *  Stesse immagini del sito storico: sono i loro clienti veri, e sostituirle
 *  con figure di repertorio su una pagina che vende un risultato estetico
 *  sarebbe la cosa meno credibile che si possa fare.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight, BadgeCheck, CalendarCheck, Camera, CheckCircle2, ChevronDown, Clock,
  Fingerprint, Gauge, Layers, Lock, MessageCircle, Quote, ScanFace, ShieldCheck,
  Sparkles, Star, Waves, X,
} from "lucide-react";
import { BookingFunnel } from "@/landing/booking/BookingFunnel";
import { formaValida } from "@/prova/codici";

const T = "Capelli folti in meno di 2 ore — Hair Genius Labs";
const D = "Invisible Derm Protocol®: densità immediata, zero chirurgia, effetto indistinguibile. Consulenza gratuita e anteprima con i tuoi capelli.";

export const Route = createFileRoute("/nuova")({
  head: () => ({
    meta: [
      { title: T },
      { name: "description", content: D },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: T },
      { property: "og:description", content: D },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Hair Genius Labs" },
      { property: "og:locale", content: "it_IT" },
      { name: "theme-color", content: "#04070f" },
    ],
  }),
  component: Landing,
});

//  ⚠️ Le fotografie stanno sul sito storico e si richiamano da lì: copiarle
//   dentro questo progetto vorrebbe dire due copie che un giorno divergono, e
//   la pagina che mostra quella vecchia.
const F = "https://hairgeniuslabs.hair/wp-content/uploads";
const IMG = {
  logo: `${F}/2024/02/2Logo-PNG-WHITE-1024x242.png`,
  eroe: `${F}/2024/02/1111-1-1.webp`,
  protocollo: `${F}/2026/02/Progetto-senza-titolo-22-1.webp`,
  dettaglio: `${F}/2026/02/Progetto-senza-titolo-20-1.webp`,
  vita: `${F}/2026/02/Progetto-senza-titolo-21-1.webp`,
  prima: `${F}/2024/02/1.webp`,
  dopo: `${F}/2024/02/2-1.webp`,
};

const WHATSAPP_PREDEFINITO = "393793244356";

/** ── LA PROVA: SI ENTRA CON UN CODICE ──────────────────────────────────────
 *  ⚠️ Non è un capriccio: ogni anteprima costa allo studio, e una pagina
 *   aperta senza porta verrebbe consumata da chiunque passi. Il codice si
 *   chiede su WhatsApp — che è dove queste persone scrivono già — e in cambio
 *   si apre una conversazione con qualcuno che è interessato davvero.
 *  ⚠️ E si dice PERCHÉ, non solo che serve: «serve un codice» è un muro,
 *   «te lo mandiamo su WhatsApp in un minuto, così l'anteprima resta tua» è
 *   un passaggio.
 */
function ModaleProva({ chiudi, numero }: { chiudi: () => void; numero: string }) {
  const [codice, setCodice] = useState("");
  const pulito = codice.trim().toUpperCase();
  const valido = formaValida(pulito);
  const messaggio = encodeURIComponent(
    "Ciao! Vorrei il codice per provare l'anteprima capelli e vedermi con i capelli folti.",
  );

  useEffect(() => {
    const suEsc = (e: KeyboardEvent) => { if (e.key === "Escape") chiudi(); };
    document.addEventListener("keydown", suEsc);
    return () => document.removeEventListener("keydown", suEsc);
  }, [chiudi]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm duration-200 animate-in fade-in"
      onClick={chiudi}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/12 bg-[#080d1a] p-6 shadow-2xl duration-300 animate-in zoom-in-95 sm:p-8"
      >
        <span className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
        <button
          onClick={chiudi}
          aria-label="Chiudi"
          className="absolute right-4 top-4 rounded-full border border-white/10 p-2 text-white/50 transition hover:border-white/30 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <span className="relative inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
          <ScanFace className="h-3.5 w-3.5" /> anteprima capelli
        </span>
        <h3 className="relative mt-4 text-2xl font-semibold leading-tight text-white sm:text-3xl">
          Guardati con i capelli,
          <br className="hidden sm:block" /> prima di decidere qualsiasi cosa
        </h3>
        <p className="relative mt-3 text-[15px] leading-relaxed text-white/60">
          Carichi una tua foto, scegli il taglio e ti vedi. Per aprirla serve un codice
          personale: te lo mandiamo su WhatsApp in meno di un minuto, insieme a tre prove
          incluse. Serve a tenere l'anteprima riservata e a non farla usare da chi passa.
        </p>

        <div className="relative mt-6 space-y-3">
          <a
            href={`https://wa.me/${numero}?text=${messaggio}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hg-shine flex w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-500 px-6 py-4 text-[16px] font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400"
          >
            <MessageCircle className="h-5 w-5" /> Richiedi il codice su WhatsApp
          </a>

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/30">ce l'hai già</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <div className="flex gap-2">
            <input
              value={codice}
              onChange={(e) => setCodice(e.target.value)}
              placeholder="ABCD-1234"
              className="min-w-0 flex-1 rounded-2xl border border-white/12 bg-black/30 px-4 py-3.5 text-center text-lg font-semibold tracking-[0.18em] text-white outline-none transition placeholder:tracking-normal placeholder:text-white/20 focus:border-cyan-400/50"
            />
            <a
              href={valido ? `/prova-capelli?c=${encodeURIComponent(pulito)}` : undefined}
              aria-disabled={!valido}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-5 py-3.5 font-semibold transition ${
                valido
                  ? "bg-cyan-500 text-[#04070f] hover:bg-cyan-400"
                  : "pointer-events-none bg-white/[0.06] text-white/25"
              }`}
            >
              Entra <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/*  ⚠️ La riga sulla foto sta QUI e non nella pagina dopo: è la domanda
            che una persona si fa prima di premere, non dopo. */}
        <p className="relative mt-5 flex items-start gap-2 text-[12px] leading-relaxed text-white/35">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/70" />
          La tua foto non viene salvata sui nostri server: resta sul tuo dispositivo e serve
          solo a creare l'anteprima.
        </p>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
      {children}
    </span>
  );
}

function Titolo({ occhiello, titolo, sotto }: { occhiello: string; titolo: React.ReactNode; sotto?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/80">{occhiello}</span>
      <h2 className="mt-4 text-[2rem] font-semibold leading-[1.1] tracking-tight text-white sm:text-[2.6rem]">{titolo}</h2>
      {!!sotto && <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-white/50">{sotto}</p>}
    </div>
  );
}

const VANTAGGI = [
  { icona: Clock, titolo: "Risultato in giornata", testo: "Entri con il problema, esci con i capelli. Nessuna attesa di mesi, nessun risultato da immaginare." },
  { icona: ShieldCheck, titolo: "Zero chirurgia", testo: "Niente bisturi, niente anestesia, niente convalescenza. Il giorno dopo sei al lavoro." },
  { icona: Fingerprint, titolo: "Costruito sul tuo viso", testo: "Attaccatura, densità e direzione del capello sono progettate sulle tue proporzioni, non su una taglia standard." },
  { icona: Waves, titolo: "Mare, palestra, doccia", testo: "Tiene sotto l'acqua, sotto il sudore e sotto il phon. Vivi come vivevi prima, senza pensarci." },
  { icona: Layers, titolo: "Membrana impercettibile", testo: "Al tatto non si sente, alla vista non si vede. È la parte su cui non abbiamo mai risparmiato." },
  { icona: Gauge, titolo: "Capello vero, non sintetico", testo: "Si lava, si asciuga, si piastra e si taglia dal barbiere come i tuoi." },
];

const PASSI = [
  { n: "01", icona: CalendarCheck, titolo: "Consulenza gratuita", testo: "Guardiamo la tua situazione e ti diciamo la verità: se il caso è da protocollo non chirurgico o da trapianto tradizionale." },
  { n: "02", icona: Fingerprint, titolo: "Progettazione su misura", testo: "Rileviamo forma del viso, attaccatura e densità. Da qui nasce un pezzo unico, costruito per te." },
  { n: "03", icona: Sparkles, titolo: "Installazione in 2 ore", testo: "Un appuntamento solo. Esci dallo studio con i capelli e con le istruzioni per gestirli da solo." },
];

const RECENSIONI = [
  {
    nome: "Gianfranco", dove: "Reggio Emilia",
    testo: "Ero molto scettico. La tenuta è incredibile: faccio il bagno al mare più volte e resiste a qualsiasi cosa. Ho ritrovato fiducia in me stesso, sembra che ho dieci anni di meno. Avrei dovuto farlo molto prima.",
  },
  {
    nome: "Marco", dove: "Frosinone",
    testo: "Ero già portatore da tre anni e ho cambiato azienda. Membrana e capello sono un'altra cosa: la sensazione è come se non ci fosse nulla sulla testa, e l'attaccatura non la nota nessuno.",
  },
  {
    nome: "Andrea", dove: "Sicilia",
    testo: "Dopo due trapianti chirurgici falliti. Nessun fastidio né prurito, neanche dopo due ore di crossfit al giorno fra sudore e docce. Regge in modo incredibile.",
  },
];

const DOMANDE = [
  { d: "Si vede che non sono i miei capelli?", r: "No, ed è tutto il mestiere: capello vero, membrana ultrasottile e attaccatura disegnata sulle tue proporzioni. Chi ti sta davanti vede solo che hai i capelli." },
  { d: "Quanto dura l'installazione?", r: "Meno di due ore, in un appuntamento solo. Non c'è recupero: dallo studio esci già pronto." },
  { d: "Posso fare sport, mare e piscina?", r: "Sì, senza limitazioni. Tiene sotto acqua, sudore e vento — è la domanda che ci fanno tutti e la risposta è nelle recensioni." },
  { d: "Quanto costa?", r: "Dipende dall'estensione dell'area e dal tipo di capello: per questo la consulenza è gratuita e senza impegno. Ti diciamo la cifra esatta prima di qualsiasi decisione." },
  { d: "E se il mio caso fosse da trapianto tradizionale?", r: "Te lo diciamo. Abbiamo anche quella strada, e proporre la soluzione sbagliata a una persona è il modo più veloce per perderla." },
];

function Landing() {
  const [prova, setProva] = useState(false);
  const [numero, setNumero] = useState(WHATSAPP_PREDEFINITO);
  const [aperta, setAperta] = useState<number | null>(0);

  //  Il numero per il codice si legge dalle impostazioni: se lo studio lo
  //  cambia, questa pagina lo segue senza ripubblicare niente.
  useEffect(() => {
    void (async () => {
      try {
        const j = await fetch("/api/public/prova-capelli?azione=contatto").then((r) => r.json());
        const n = String(j?.numero || "").replace(/[^\d]/g, "");
        if (n.length >= 8) setNumero(n);
      } catch { /* resta il numero dello studio */ }
    })();
  }, []);

  const alModulo = () => document.getElementById("prenota")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="min-h-screen bg-[#04070f] text-white antialiased">
      {/* ── BARRA ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#04070f]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <img src={IMG.logo} alt="Hair Genius Labs" className="h-7 w-auto sm:h-8" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setProva(true)}
              className="hidden items-center gap-2 rounded-xl border border-white/12 px-4 py-2.5 text-sm font-medium text-white/75 transition hover:border-cyan-400/40 hover:text-white sm:flex"
            >
              <ScanFace className="h-4 w-4 text-cyan-300" /> Anteprima capelli
            </button>
            <button
              onClick={alModulo}
              className="hg-shine rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
            >
              Consulenza gratuita
            </button>
          </div>
        </div>
      </header>

      {/* ── PRIMO SCHERMO ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/*  Il fondo: griglia tecnica e due aurore. È il vestito «laboratorio»,
            e serve a far leggere questo come uno studio, non come un negozio. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)",
              backgroundSize: "72px 72px",
              maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%)",
            }}
          />
          <div className="hg-aurora absolute -left-40 top-[-10rem] h-[34rem] w-[34rem] rounded-full bg-cyan-500/18 blur-[110px]" />
          <div className="hg-aurora-slow absolute -right-32 top-20 h-[30rem] w-[30rem] rounded-full bg-violet-600/18 blur-[110px]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-14 lg:grid-cols-[1.05fr_.95fr] lg:pb-24 lg:pt-20">
          <div>
            <Chip>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
              </span>
              Invisible Derm Protocol®
            </Chip>

            <h1 className="mt-6 text-[2.6rem] font-semibold leading-[1.02] tracking-tight sm:text-[3.6rem] lg:text-[4rem]">
              Capelli folti
              <br />
              <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">
                in meno di 2 ore
              </span>
            </h1>

            {/*  ⚠️ Il sottotitolo dice le tre cose che tolgono la paura, in
                tre parole ciascuna: niente bisturi, oggi, e non si vede. Sono
                le tre obiezioni vere — il resto della pagina le argomenta. */}
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/60 sm:text-[19px]">
              Senza bisturi, senza attese, senza che si veda. Il nostro protocollo non
              chirurgico ricostruisce densità e attaccatura sulle proporzioni del tuo viso —
              in un solo appuntamento.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={alModulo}
                className="hg-shine hg-cta-glow group flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-7 py-4 text-[16px] font-semibold text-white shadow-xl shadow-cyan-500/25 transition hover:brightness-110"
              >
                Prenota la consulenza gratuita
                <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
              </button>
              {/* ── ⚠️ LA SECONDA VIA, PER CHI NON È PRONTO A PARLARE ────
                    Chi arriva da un annuncio non lascia il numero al primo
                    schermo. Questo tasto gli dà qualcosa da fare adesso — si
                    vede con i capelli — e trasforma «ci penso» in un gesto. */}
              <button
                onClick={() => setProva(true)}
                className="group flex items-center justify-center gap-2.5 rounded-2xl border border-white/15 bg-white/[0.04] px-7 py-4 text-[16px] font-semibold text-white/85 backdrop-blur transition hover:border-cyan-400/40 hover:bg-white/[0.07] hover:text-white"
              >
                <Camera className="h-5 w-5 text-cyan-300 transition-transform group-hover:scale-110" />
                Guardati con i capelli
              </button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] text-white/45">
              <span className="flex items-center gap-1.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
                <b className="ml-1 font-semibold text-white/80">4.9</b> · 1.326 recensioni
              </span>
              <span className="flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-cyan-300" /> Studio a Roma, Via degli Scipioni
              </span>
            </div>
          </div>

          {/* la fotografia, con il suo alone */}
          <div className="relative">
            <div aria-hidden className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-tr from-cyan-500/20 to-violet-500/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-white/[0.03]">
              <img src={IMG.eroe} alt="Risultato Invisible Derm Protocol" className="w-full object-cover" loading="eager" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#04070f] via-[#04070f]/70 to-transparent p-5 pt-14">
                <div className="flex items-center gap-2 text-[13px] font-medium text-white/85">
                  <CheckCircle2 className="h-4 w-4 text-cyan-300" />
                  Risultato reale, stesso giorno dell'installazione
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PERCHÉ ───────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/[0.06] py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Titolo
            occhiello="perché funziona"
            titolo={<>Non è una protesi.<br />È un protocollo su misura.</>}
            sotto="Non è una patch, non è un prodotto uguale per tutti: ogni installazione nasce dalla forma del tuo viso, dalla tua attaccatura e dal risultato che vuoi ottenere."
          />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VANTAGGI.map((v) => {
              const I = v.icona;
              return (
                <div
                  key={v.titolo}
                  className="hg-lucido group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 transition hover:-translate-y-1 hover:border-cyan-400/25"
                >
                  <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-500/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
                  <span className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/15 to-violet-500/10">
                    <I className="h-5.5 w-5.5 text-cyan-300 transition-transform duration-300 group-hover:scale-110" />
                  </span>
                  <h3 className="relative mt-5 text-[17px] font-semibold text-white">{v.titolo}</h3>
                  <p className="relative mt-2 text-[14.5px] leading-relaxed text-white/50">{v.testo}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── COME FUNZIONA ────────────────────────────────────────────── */}
      <section className="relative border-t border-white/[0.06] bg-white/[0.015] py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Titolo occhiello="il percorso" titolo={<>Tre passaggi, un solo appuntamento</>} />
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {PASSI.map((p) => {
              const I = p.icona;
              return (
                <div key={p.n} className="relative rounded-2xl border border-white/[0.08] bg-[#070c18] p-7">
                  <span className="absolute right-6 top-5 text-[2.6rem] font-bold leading-none text-white/[0.06]">{p.n}</span>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10">
                    <I className="h-5.5 w-5.5 text-cyan-300" />
                  </span>
                  <h3 className="mt-5 text-[18px] font-semibold">{p.titolo}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-white/50">{p.testo}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[IMG.protocollo, IMG.dettaglio, IMG.vita].map((src) => (
              <div key={src} className="overflow-hidden rounded-2xl border border-white/[0.08]">
                <img src={src} alt="" loading="lazy" className="h-full w-full object-cover transition duration-700 hover:scale-105" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRIMA / DOPO + ANTEPRIMA ─────────────────────────────────── */}
      <section className="relative border-t border-white/[0.06] py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="grid grid-cols-2 gap-4">
              {[{ src: IMG.prima, et: "PRIMA" }, { src: IMG.dopo, et: "DOPO" }].map((x) => (
                <figure key={x.et} className="relative overflow-hidden rounded-2xl border border-white/10">
                  <img src={x.src} alt={x.et} loading="lazy" className="w-full object-cover" />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
                    {x.et}
                  </figcaption>
                </figure>
              ))}
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/80">prima di decidere</span>
              <h2 className="mt-4 text-[2rem] font-semibold leading-[1.1] tracking-tight sm:text-[2.6rem]">
                Vediti con i capelli.<br />Oggi, dal telefono.
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-white/55">
                Carichi una foto, scegli il taglio e ti guardi. Non è il risultato finale — quello
                lo costruiamo insieme in studio, e viene meglio — ma è il modo più onesto per
                capire se questa strada fa per te prima di sederti in poltrona.
              </p>
              <button
                onClick={() => setProva(true)}
                className="hg-shine mt-7 flex items-center gap-2.5 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-6 py-3.5 font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                <ScanFace className="h-5 w-5" /> Apri l'anteprima capelli
              </button>
              <p className="mt-3 flex items-center gap-2 text-[12.5px] text-white/35">
                <Lock className="h-3.5 w-3.5 text-emerald-400/70" /> La foto resta sul tuo dispositivo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── RECENSIONI ───────────────────────────────────────────────── */}
      <section className="relative border-t border-white/[0.06] bg-white/[0.015] py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Titolo
            occhiello="1.326 recensioni verificate"
            titolo={<>Le persone che l'hanno già fatto</>}
            sotto="Recensioni raccolte su Trustpilot da clienti reali, aggiornate a oggi."
          />
          <div className="mt-14 grid gap-4 lg:grid-cols-3">
            {RECENSIONI.map((r) => (
              <figure key={r.nome} className="relative rounded-2xl border border-white/[0.08] bg-[#070c18] p-6">
                <Quote className="h-7 w-7 text-cyan-400/25" />
                <blockquote className="mt-3 text-[15px] leading-relaxed text-white/70">{r.testo}</blockquote>
                <figcaption className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4">
                  <span className="text-[14px] font-semibold text-white">
                    {r.nome} <span className="font-normal text-white/40">· {r.dove}</span>
                  </span>
                  <span className="flex gap-0.5">
                    {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />)}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── IL MODULO ────────────────────────────────────────────────── */}
      <section id="prenota" className="relative scroll-mt-20 overflow-hidden border-t border-white/[0.06] py-20 sm:py-24">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="hg-aurora absolute left-1/2 top-0 h-[28rem] w-[40rem] -translate-x-1/2 rounded-full bg-cyan-500/12 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-5">
          <div className="text-center">
            <Chip>
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" /> 100 € di sconto — prime 107 adesioni del mese
            </Chip>
            <h2 className="mt-6 text-[2rem] font-semibold leading-[1.08] tracking-tight sm:text-[2.7rem]">
              Prenota la tua consulenza gratuita
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-white/55">
              Analizziamo la tua situazione, ti mostriamo casi reali e ti diciamo con che
              soluzione otterresti il risultato migliore — anche quando la risposta è il
              trapianto tradizionale. Nessun impegno, nessuna insistenza.
            </p>
          </div>

          {/*  ⚠️ Qui dentro c'è il modulo della landing attuale, non una copia:
              calendario, qualifica e tracciamento sono quelli già misurati. */}
          <div className="mt-10 rounded-3xl border border-white/[0.09] bg-[#070c18]/80 p-5 backdrop-blur sm:p-7">
            <BookingFunnel variant="dark" />
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {["Consulenza senza impegno", "Preventivo chiaro, subito", "Anche a distanza, in video"].map((t) => (
              <div key={t} className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[13.5px] text-white/60">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DOMANDE ──────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/[0.06] bg-white/[0.015] py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-5">
          <Titolo occhiello="domande" titolo={<>Quello che ci chiedono tutti</>} />
          <div className="mt-12 space-y-3">
            {DOMANDE.map((q, i) => (
              <div key={q.d} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#070c18]">
                <button
                  onClick={() => setAperta(aperta === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15.5px] font-medium text-white/90 transition hover:text-white"
                >
                  {q.d}
                  <ChevronDown className={`h-4.5 w-4.5 shrink-0 text-cyan-300 transition-transform duration-300 ${aperta === i ? "rotate-180" : ""}`} />
                </button>
                {aperta === i && (
                  <p className="border-t border-white/[0.06] px-5 py-4 text-[14.5px] leading-relaxed text-white/55 duration-300 animate-in fade-in slide-in-from-top-1">
                    {q.r}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CHIUSURA ─────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/[0.06] py-20 text-center sm:py-24">
        <div className="mx-auto max-w-2xl px-5">
          <h2 className="text-[2rem] font-semibold leading-[1.1] tracking-tight sm:text-[2.5rem]">
            Qui le cose non si fanno a caso.<br />
            <span className="bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-transparent">Si fanno su misura.</span>
          </h2>
          <button
            onClick={alModulo}
            className="hg-shine mx-auto mt-8 flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-4 text-[16px] font-semibold shadow-xl shadow-cyan-500/25 transition hover:brightness-110"
          >
            Richiedi i 100 € di sconto <ArrowRight className="h-4.5 w-4.5" />
          </button>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] px-5 py-10 text-center">
        <img src={IMG.logo} alt="Hair Genius Labs" className="mx-auto h-7 w-auto opacity-70" />
        <p className="mt-5 text-[13px] text-white/40">
          Via degli Scipioni 132, Roma 00192 · hairgeniuslabs@gmail.com · +39 379 324 4356
        </p>
        <p className="mt-2 text-[12px] text-white/25">
          © {new Date().getFullYear()} Hair Genius Labs SRLS — P.IVA 18486531009
        </p>
      </footer>

      {/* ── LA BARRA CHE RESTA SUL TELEFONO ──────────────────────────────
            ⚠️ Solo sotto i 640 punti: su un telefono il tasto principale
            scorre via col primo swipe, e chi si convince a metà pagina non
            deve cercare dove premere. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#04070f]/95 p-3 backdrop-blur-xl sm:hidden">
        <div className="flex gap-2">
          <button
            onClick={() => setProva(true)}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/12 px-4 py-3.5 text-sm font-semibold text-white/80"
          >
            <Camera className="h-4 w-4 text-cyan-300" /> Provalo
          </button>
          <button
            onClick={alModulo}
            className="hg-shine flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3.5 text-sm font-semibold"
          >
            Consulenza gratuita <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="h-20 sm:hidden" />

      {prova && <ModaleProva chiudi={() => setProva(false)} numero={numero} />}
    </div>
  );
}
