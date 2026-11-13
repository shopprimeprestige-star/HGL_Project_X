/** ── /invisible-derm: LA LANDING «SOLO INVISIBLE DERM» ──────────────────────
 *  Fonte: `20-sito/2026-11-12-landing-invisible-derm.md` (testi: sez. 3, design: sez. 4).
 *  Stessa grammatica della home (fondi, eyebrow, ng-pillar, ng-pill, brackets, Inter, BookingFunnel),
 *  senza i suoi elementi «da catalogo»: niente shop, niente prezzi, niente conto alla rovescia, niente rosso.
 *
 *  ⚠️ FUORI DAI MOTORI DI RICERCA: `noindex,follow` e non è in PAGINE_PUBBLICHE (quindi neanche nella
 *   sitemap): è una pagina per annunci e Reel, la home resta l'unica indicizzata.
 *  ⚠️ SLOT VUOTO = NON SI DISEGNA NIENTE. Niente riquadri grigi: senza media la pagina è solo testo
 *   (non pubblicabile finché mancano il video del titolare e le coppie di confronto).
 *  ⚠️ LIBERATORIE: confronti e clip con persone si mostrano solo se nel CRM c'è scritto «sì» nel campo
 *   della liberatoria (`liberatoriaOk`).
 *  shortcut: la sezione 8 (video recensioni) non c'è: serve un interruttore di liberatoria per ogni
 *   recensione; aggiungerla quando arrivano video e consensi. L'`og:image` (`id.heroFoto`) non c'è:
 *   la testata è statica e il file vive nel CRM; servirebbe un loader. */
import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import {
  CalendarCheck,
  Check,
  Clock,
  Droplets,
  Dumbbell,
  Layers,
  MapPin,
  Ruler,
  Sun,
  Video,
  Waves,
  Wind,
} from "lucide-react";
import { SITO } from "@/seo/regole";
import { BookingFunnel } from "@/landing/booking/BookingFunnel";
import {
  initAdminCheck,
  initClickTracking,
  initHeartbeat,
  initHighQualityVisit,
  initLivePresence,
  initScrollTracking,
  subscribeAdminStatus,
} from "@/landing/booking/tracking";
import { CookieBanner } from "@/components/landing/CookieBanner";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { MediaSlot } from "@/components/landing/MediaSlot";
import { RichText } from "@/components/landing/RichText";
import { BarraPrenotaId } from "@/components/landing/invisible-derm/BarraPrenotaId";
import { ClipLoop } from "@/components/landing/invisible-derm/ClipLoop";
import { DisegnoConfronto } from "@/components/landing/invisible-derm/DisegnoConfronto";
import { CursoreConfronto } from "@/components/landing/invisible-derm/CursoreConfronto";
import { FooterId } from "@/components/landing/invisible-derm/FooterId";
import { TabellaConfronto } from "@/components/landing/invisible-derm/TabellaConfronto";
import { VideoSlot } from "@/components/landing/invisible-derm/VideoSlot";
import { BarraModifica, PuntoModifica, useModificaAttiva } from "@/components/landing/invisible-derm/ModificaImmagini";
import { useLandingContent } from "@/landing/landing-content";
import {
  BOTTONE,
  CONFRONTO,
  COSE,
  FAQ,
  HERO,
  MARCHIO,
  META,
  PASSI,
  PRENOTA,
  PRIMA_DOPO,
  SLOT_PRIMA_DOPO,
  RESISTENTE,
  RIGA_BOTTONE,
  STUDIO,
  TABELLA,
  liberatoriaOk,
} from "@/landing/testi-invisible-derm";
import logo from "@/assets/logo-hair-genius.png";

export const Route = createFileRoute("/invisible-derm")({
  component: InvisibleDerm,
  head: () => ({
    links: [{ rel: "canonical", href: `${SITO}/invisible-derm` }],
    meta: [
      { title: META.titolo },
      { name: "description", content: META.descrizione },
      { name: "robots", content: "noindex,follow" },
      { property: "og:title", content: META.titolo },
      { property: "og:description", content: META.descrizione },
      { name: "theme-color", content: "#0a1a3a" },
    ],
  }),
});

const ICONE_VITA = [Waves, Droplets, Dumbbell, Wind];
const ICONE_PASSI = [CalendarCheck, Video, Clock];
const ICONE_FATTI = [Layers, Ruler, MapPin];

/** Solo da 1024 px: sul telefono il modulo dell'hero non si monta (un solo modulo vivo, un solo tracciamento). */
function useSchermoLargo() {
  const [largo, setLargo] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const aggiorna = () => setLargo(m.matches);
    aggiorna();
    m.addEventListener("change", aggiorna);
    return () => m.removeEventListener("change", aggiorna);
  }, []);
  return largo;
}

/** Tracciamento come la home: niente se chi guarda è l'admin. */
function useTracciamento() {
  useEffect(() => {
    let chiudi: (() => void)[] = [];
    const spegni = () => {
      chiudi.forEach((f) => f());
      chiudi = [];
    };
    initAdminCheck().then((isAdmin) => {
      if (isAdmin) return;
      chiudi = [initScrollTracking(), initClickTracking(), initHeartbeat(), initLivePresence(), initHighQualityVisit(40, 50)];
    });
    const smetti = subscribeAdminStatus((isAdmin) => {
      if (isAdmin) spegni();
    });
    return () => {
      smetti();
      spegni();
    };
  }, []);
}

/** Chi arriva da un link a `#prenota` atterra sul titolo del modulo (focus), non resta in cima per chi naviga da tastiera. */
function useFocusPrenota() {
  useEffect(() => {
    const clic = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest("a[href='#prenota']")) {
        setTimeout(() => document.getElementById("prenota-titolo")?.focus({ preventScroll: true }), 0);
      }
    };
    document.addEventListener("click", clic);
    return () => document.removeEventListener("click", clic);
  }, []);
}

function Pillola({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
      <Check className="h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden="true" />
      {children}
    </span>
  );
}

/** Il bottone è uno solo e uguale ovunque: naviga a #prenota (è un link, non un'azione). */
function Bottone({ traccia, className = "" }: { traccia: string; className?: string }) {
  return (
    <a
      href="#prenota"
      data-track={traccia}
      className={`inline-flex min-h-12 w-full items-center justify-center rounded-md bg-brand-scuro px-6 text-base font-semibold text-brand-foreground hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto ${className}`}
    >
      {BOTTONE}
    </a>
  );
}

function Cta({ traccia }: { traccia: string }) {
  return (
    <div data-barra-nascondi="vista" className="text-center">
      <Bottone traccia={traccia} />
      <p className="mt-3 text-sm text-white/75">{RIGA_BOTTONE}</p>
    </div>
  );
}

const SEZIONE = "px-6 lg:px-10 max-w-7xl mx-auto py-16 sm:py-20 lg:py-28";
const H2 = "mt-4 text-3xl md:text-5xl font-bold tracking-tight leading-[1.05] text-balance";

function Testata({ id, sopratitolo, children, centrato = true, scuro = false }: { id: string; sopratitolo: string; children: React.ReactNode; centrato?: boolean; scuro?: boolean }) {
  return (
    <div className={centrato ? "mx-auto max-w-3xl text-center" : ""}>
      <div className="eyebrow">{sopratitolo}</div>
      <h2 id={id} className={`${H2} ${scuro ? "text-white" : "text-ink"}`}>
        {children}
      </h2>
    </div>
  );
}

function Pilastro({ n, Icon, titolo, testo, kicker, didascalia, media, className = "" }: { n: string; Icon: typeof Ruler; titolo: string; testo: string; kicker?: string; didascalia?: string; media?: React.ReactNode; className?: string }) {
  return (
    <div className={`ng-pillar p-7 ${className}`}>
      {media ? (
        <div className="-mx-7 -mt-7 mb-6 [&>div]:rounded-none">{media}</div>
      ) : (
        <>
          <span className="ng-pillar__num">{n}</span>
          <div className="ng-pillar__icon mb-6">
            <Icon className="relative z-10 h-6 w-6" strokeWidth={2} />
          </div>
        </>
      )}
      <h3 className="text-lg font-bold tracking-tight text-ink">{titolo}</h3>
      {media && kicker && <div className="ng-pillar__kicker mt-3">{kicker}</div>}
      <p className="mt-3 text-base leading-relaxed text-ink-muted">{testo}</p>
      {media && didascalia && <p className="mt-3 text-sm text-ink-muted">{didascalia}</p>}
    </div>
  );
}

function Trascrizione({ testo }: { testo: string }) {
  if (!testo) return null;
  return (
    <details className="mt-3 text-sm text-ink-muted">
      <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold underline underline-offset-4">{COSE.linkTrascrizione}</summary>
      <p className="mt-2 whitespace-pre-line leading-relaxed">{testo}</p>
    </details>
  );
}

function InvisibleDerm() {
  const { text, media } = useLandingContent();
  const largo = useSchermoLargo();
  useTracciamento();
  useFocusPrenota();
  const alt = (chiave: string) => text(`${chiave}.alt`);
  const modifica = useModificaAttiva();
  const punto = (titolo: string, chiavi: string[], liberatoria?: { chiave: string; testo: string }) => (
    <PuntoModifica attiva={modifica} titolo={titolo} chiavi={chiavi} media={media} text={text} liberatoria={liberatoria} />
  );
  const LIB = "Ho la liberatoria scritta di chi è ritratto (senza, queste foto non compaiono sulla pagina)";

  const titolareFoto = media("id.titolareFoto");
  const heroFoto = media("id.heroFoto");
  const videoPres = media("id.presentazioneVideo");
  const confrontoOk = liberatoriaOk(text("id.confronto.liberatoria"));
  // una coppia incompleta (manca un file) o senza liberatoria sparisce intera
  const coppia = (k: string) => confrontoOk && !!media(`${k}.patch`) && !!media(`${k}.derm`);
  const c1 = coppia("id.confronto1");
  const c2 = coppia("id.confronto2");
  const c3Foto = coppia("id.confronto3");
  const coppia3Clip = confrontoOk && !!media("id.confronto3.patchClip") && !!media("id.confronto3.dermClip");
  const videoConfronto = media("id.confrontoVideo");
  const haConfronti = c1 || c2 || c3Foto || coppia3Clip || !!videoConfronto;
  const test = media("id.testVideo");
  const sottileFoto = media("id.sottileFoto");
  const vita = ICONE_VITA.map((Icona, i) => ({ Icona, i, src: media(`id.vita${i + 1}`) })).filter((v) => v.src);
  const vitaOk = liberatoriaOk(text("id.vita.liberatoria")) && vita.length >= 2;
  const studio = [1, 2, 3].map((n) => ({ src: media(`id.studio${n}`), chiave: `id.studio${n}`, i: n - 1 })).filter((s) => s.src);
  const studioVideo = media("id.studioVideo");
  const primaDopoOk = liberatoriaOk(text("id.primaDopo.liberatoria"));
  const casi = PRIMA_DOPO.casi.filter((c) => primaDopoOk && !!media(`${c.chiave}.prima`) && !!media(`${c.chiave}.dopo`));
  const videoPD = PRIMA_DOPO.video.filter((v) => primaDopoOk && !!media(v.chiave));
  const haPrimaDopo = casi.length > 0 || videoPD.length > 0;
  const ritratto = (px: string) =>
    titolareFoto ? (
      <div className={`${px} shrink-0 overflow-hidden rounded-full border-2 border-white/20`}>
        <MediaSlot src={titolareFoto} type="image" alt={alt("id.titolareFoto")} proporzione="aspect-square" light={false} />
      </div>
    ) : null;

  return (
    <main id="top" className="min-h-screen overflow-x-hidden">
      {modifica && <BarraModifica />}
      {/* 0 + 1 · RIGA DEL MARCHIO E HERO */}
      <section
        aria-labelledby="titolo-principale"
        className="bg-blueprint relative overflow-hidden before:pointer-events-none before:absolute before:inset-[-20%] before:content-[''] before:bg-[radial-gradient(600px_circle_at_30%_20%,var(--brand-velo-22)_0%,transparent_60%)] before:animate-[spotlight-drift_12s_ease-in-out_infinite] motion-reduce:before:animate-none"
      >
        {punto("Inizio pagina", ["id.heroFoto", "id.titolareFoto"])}
        <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-6 lg:px-10 lg:pb-24 lg:pt-8">
          <a href="#contenuto" className="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-ink">
            Vai al contenuto
          </a>
          <header className="mb-10 flex items-center justify-between gap-6 lg:mb-14">
            <div className="flex flex-col items-start gap-2 lg:flex-row lg:items-center lg:gap-6">
              <div className="brackets inline-flex items-center justify-center px-4 py-2.5">
                <span className="br-tr" />
                <span className="br-bl" />
                <img src={logo} alt={MARCHIO.altLogo} className="h-7 w-auto select-none lg:h-9" draggable={false} />
              </div>
              <p className="text-etichetta uppercase tracking-[0.18em] text-white/75">{MARCHIO.indirizzo}</p>
            </div>
            <a href="#prenota" className="hidden min-h-11 items-center text-sm text-white underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:inline-flex">
              {BOTTONE}
            </a>
          </header>

          <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <div id="contenuto" tabIndex={-1} className="flex flex-col outline-none">
              <p className="ng-hero-eyebrow mb-4">
                <span className="ng-hero-eyebrow__line">{HERO.sopratitolo[0]}</span>
                <span className="ng-hero-eyebrow__line ng-hero-eyebrow__line--accent">{HERO.sopratitolo[1]}</span>
              </p>
              <h1 id="titolo-principale" className="text-balance text-[1.875rem] font-bold leading-[1.08] tracking-tight md:text-5xl lg:text-6xl">
                <RichText value={HERO.h1} highlightClass="text-aurora" />
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 md:text-lg">{HERO.sottotitolo}</p>

              {/* sul telefono il bottone viene prima delle pillole, per restare nella prima schermata */}
              <div className={`order-4 mt-8 lg:order-5 ${titolareFoto ? "" : "lg:hidden"}`}>
                <Bottone traccia="cta_hero_clic" className="lg:hidden" />
                <div className="mt-4 flex items-center gap-4">
                  {ritratto("h-[72px] w-[72px]")}
                  <p className="text-sm text-white/75 md:text-base lg:hidden">{RIGA_BOTTONE}</p>
                </div>
              </div>
              <div className="order-5 mt-8 flex flex-wrap gap-3 lg:order-4">
                {HERO.pillole.map((p) => (
                  <Pillola key={p}>{p}</Pillola>
                ))}
              </div>
              {heroFoto && (
                <figure className="order-6 mt-8 max-w-xl">
                  <MediaSlot src={heroFoto} type="image" alt={alt("id.heroFoto")} proporzione="aspect-[16/10]" light={false} priorita className="[&_img]:object-[50%_40%]" />
                  <figcaption className="mt-2 text-sm text-white/75">{HERO.didascaliaFoto}</figcaption>
                </figure>
              )}
            </div>

            <div id="prenota-hero" data-barra-nascondi="vista" className="hidden min-h-[560px] w-full lg:block lg:pt-2">
              <p className="mb-3 text-center text-etichetta uppercase tracking-[0.22em] text-white/75">{HERO.titoloModulo}</p>
              {largo && <BookingFunnel variant="dark" />}
            </div>
          </div>
        </div>
      </section>

      {/* 2 · CHE COS'È INVISIBLE DERM */}
      <section aria-labelledby="cose-titolo" className="relative bg-light-panel">
        {punto("Che cos'è", ["id.presentazioneVideo", "id.presentazionePoster"])}
        <div className={SEZIONE}>
          <div className={videoPres ? "grid items-start gap-10 lg:grid-cols-2 lg:gap-x-16 lg:gap-y-8" : "mx-auto max-w-5xl"}>
            <div className={videoPres ? "lg:col-start-1" : "mx-auto max-w-3xl text-center"}>
              <div className="eyebrow">{COSE.sopratitolo}</div>
              <h2 id="cose-titolo" className={`${H2} text-ink`}>{COSE.h2}</h2>
              <p className="mt-6 text-xl font-semibold leading-snug text-ink md:text-2xl">{COSE.definizione}</p>
            </div>
            {videoPres && (
              <div className="mx-auto w-full max-w-[440px] lg:col-start-2 lg:row-span-2 lg:row-start-1">
                <VideoSlot src={videoPres} poster={media("id.presentazionePoster")} alt={alt("id.presentazioneVideo")} titolo={COSE.copertinaVideo} className="aspect-[4/5]" />
                <Trascrizione testo={text("id.presentazioneTrascrizione")} />
              </div>
            )}
            <div className={videoPres ? "lg:col-start-1" : ""}>
              <p className={`mt-2 max-w-xl leading-relaxed text-ink-muted md:text-lg ${videoPres ? "" : "mx-auto text-center"}`}>{COSE.corpo}</p>
              <ul className={videoPres ? "mt-8 space-y-5" : "mt-10 grid gap-4 md:grid-cols-3"}>
                {COSE.fatti.map((f, i) => {
                  const Icona = ICONE_FATTI[i];
                  return (
                    <li key={f.titolo} className={`flex gap-4 ${videoPres ? "" : "rounded-md border border-ink/15 bg-white p-5"}`}>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-scuro text-white">
                        <Icona className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <p className="text-base leading-relaxed text-ink-muted">
                        <strong className="font-bold text-ink">{f.titolo}</strong> {f.testo}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 3 · IL CONFRONTO (la leva centrale) */}
      <section aria-labelledby="confronto-titolo" className="relative bg-blueprint">
        {punto("Confronto", ["id.confronto1.patch", "id.confronto1.derm", "id.confronto2.patch", "id.confronto2.derm", "id.confronto3.patchClip", "id.confronto3.dermClip", "id.confronto3.patch", "id.confronto3.derm", "id.confrontoVideo", "id.confrontoVideoPoster"], { chiave: "id.confronto.liberatoria", testo: LIB })}
        <div className={SEZIONE}>
          <Testata id="confronto-titolo" sopratitolo={CONFRONTO.sopratitolo} scuro>
            <RichText value={haConfronti ? CONFRONTO.h2 : CONFRONTO.h2SenzaFoto} highlightClass="text-aurora" />
          </Testata>
          <p className="mx-auto mt-4 max-w-2xl text-center text-base text-white/75 md:text-lg">{haConfronti ? CONFRONTO.sottotitolo : CONFRONTO.sottotitoloSenzaFoto}</p>

          {haConfronti && (
          <div className="mx-auto mt-12 max-w-5xl space-y-14">
            {/* coppia 1, poi il video «Le due in mano», poi le altre */}
            {c1 && (
              <div className="mx-auto md:max-w-2xl">
                <CursoreConfronto numero={1} titolo={CONFRONTO.coppie[0].titolo} coppia="id.confronto1" patch={media("id.confronto1.patch")} derm={media("id.confronto1.derm")} alt={alt("id.confronto1")} subito className="aspect-[4/5] md:aspect-[4/3]" />
              </div>
            )}
            {videoConfronto && (
              <div className="rounded-md border border-white/10 bg-navy/60 p-4 lg:p-6">
                <div className="grid items-center gap-6 md:grid-cols-[minmax(0,340px)_1fr]">
                  <VideoSlot src={videoConfronto} poster={media("id.confrontoVideoPoster")} alt={alt("id.confrontoVideo")} titolo={CONFRONTO.videoTitolo} className="mx-auto aspect-[4/5] max-w-[340px]" />
                  <div>
                    <h3 className="text-xl font-bold text-white md:text-2xl">{CONFRONTO.videoTitolo}</h3>
                    <p className="mt-2 text-base text-white/75">{CONFRONTO.videoDidascalia}</p>
                    {text("id.confrontoVideoTrascrizione") && (
                      <details className="mt-3 text-sm text-white/75">
                        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-white underline underline-offset-4">{COSE.linkTrascrizione}</summary>
                        <p className="mt-2 whitespace-pre-line leading-relaxed">{text("id.confrontoVideoTrascrizione")}</p>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )}
            {c2 && (
              <div className="-mx-6 md:mx-auto md:max-w-5xl">
                <CursoreConfronto numero={2} titolo={CONFRONTO.coppie[1].titolo} coppia="id.confronto2" patch={media("id.confronto2.patch")} derm={media("id.confronto2.derm")} alt={alt("id.confronto2")} className="aspect-[4/5] md:aspect-video" />
              </div>
            )}
            {coppia3Clip ? (
              <div className="mx-auto max-w-xl">
                <h3 className="mb-3 text-center text-xl font-bold text-white md:text-2xl">
                  <span className="text-brand">3 ·</span> {CONFRONTO.coppie[2].titolo}
                </h3>
                <ClipLoop
                  nome={CONFRONTO.coppie[2].titolo}
                  className="grid grid-cols-2 gap-3"
                  clips={(["patch", "derm"] as const).map((k) => ({
                    src: media(`id.confronto3.${k}Clip`),
                    alt: alt("id.confronto3"),
                    sopra: <p className="mb-2 bg-[#081634]/90 px-3 py-2 text-center text-etichetta font-semibold uppercase tracking-[0.18em] text-white">{CONFRONTO.etichette[k]}</p>,
                  }))}
                />
                <p className="mt-3 text-center text-sm text-white/75">{CONFRONTO.didascaliaCoppia3}</p>
              </div>
            ) : (
              c3Foto && (
                <div className="mx-auto md:max-w-2xl">
                  <CursoreConfronto numero={3} titolo={CONFRONTO.coppie[2].titolo} coppia="id.confronto3" patch={media("id.confronto3.patch")} derm={media("id.confronto3.derm")} alt={alt("id.confronto3")} className="aspect-[4/5] md:aspect-[4/3]" />
                </div>
              )
            )}
          </div>
          )}

          <div className={haConfronti ? "mt-14" : "mt-12"}>
            <DisegnoConfronto />
          </div>

          <p className="mx-auto mt-14 max-w-2xl text-center text-lg text-white md:text-xl">{CONFRONTO.riga}</p>
          {/* il bottone chiude la sezione ed è il segnale «sezione 3 finita» per la barra del telefono */}
          <div data-barra-dopo="confronto" className="mt-8">
            <Cta traccia="cta_confronto_clic" />
          </div>
        </div>
      </section>

      {/* 3b · PRIMA E DOPO (clienti veri; tutta la sezione sparisce senza liberatoria o senza file, tranne in modifica) */}
      {(haPrimaDopo || modifica) && (
        <section aria-labelledby="primadopo-titolo" className="relative border-t border-white/10 bg-blueprint">
          {punto("Prima e dopo", SLOT_PRIMA_DOPO.map((s) => s.chiave), { chiave: "id.primaDopo.liberatoria", testo: LIB })}
          <div className={SEZIONE}>
            <Testata id="primadopo-titolo" sopratitolo={PRIMA_DOPO.sopratitolo} scuro>
              <RichText value={PRIMA_DOPO.h2} highlightClass="text-aurora" />
            </Testata>
            <p className="mx-auto mt-4 max-w-2xl text-center text-base text-white/75 md:text-lg">{PRIMA_DOPO.sottotitolo}</p>
            {!haPrimaDopo && <p className="mx-auto mt-8 max-w-xl rounded-md border border-dashed border-white/30 p-6 text-center text-sm text-white/75">Sezione vuota: i clienti non la vedono. Carica le foto o i video e spunta la liberatoria.</p>}
            <div className="mx-auto mt-12 grid max-w-5xl gap-14 md:grid-cols-2">
              {casi.map((c, i) => (
                <CursoreConfronto key={c.chiave} numero={i + 1} titolo={c.titolo} coppia={c.chiave} patch={media(`${c.chiave}.prima`)} derm={media(`${c.chiave}.dopo`)} alt={alt(c.chiave)} etichette={{ patch: PRIMA_DOPO.etichette.prima, derm: PRIMA_DOPO.etichette.dopo }} didascalia={PRIMA_DOPO.didascalia} className="aspect-[4/5]" />
              ))}
              {videoPD.map((v) => (
                <VideoSlot key={v.chiave} src={media(v.chiave)} poster={media(`${v.chiave}Poster`)} alt={alt(v.chiave)} titolo={v.titolo} className="mx-auto aspect-[4/5] w-full max-w-[400px]" />
              ))}
            </div>
            <div className="mt-12">
              <Cta traccia="cta_primadopo_clic" />
            </div>
          </div>
        </section>
      )}

      {/* 4 · SOTTILE, MA RESISTENTE */}
      <section aria-labelledby="resistente-titolo" className="relative bg-white-trama">
        {punto("Sottile e resistente", ["id.sottileFoto", "id.testVideo", "id.testPoster", "id.vita1", "id.vita2", "id.vita3", "id.vita4", "id.simboloFoto"], { chiave: "id.vita.liberatoria", testo: LIB })}
        <div className={SEZIONE}>
          <Testata id="resistente-titolo" sopratitolo={RESISTENTE.sopratitolo}>
            <RichText value={RESISTENTE.h2} highlightClass="text-brand" />
          </Testata>
          <p className="mx-auto mt-4 max-w-2xl text-center text-base text-ink-muted md:text-lg">{RESISTENTE.introduzione}</p>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <Pilastro
              n={RESISTENTE.sottile.numero}
              Icon={Ruler}
              titolo={RESISTENTE.sottile.titolo}
              testo={RESISTENTE.sottile.testo}
              kicker={RESISTENTE.sottile.kicker}
              didascalia={RESISTENTE.sottile.didascalia}
              media={sottileFoto ? <MediaSlot src={sottileFoto} type="image" alt={alt("id.sottileFoto")} proporzione="aspect-[4/3]" /> : null}
            />
            <Pilastro
              n={RESISTENTE.resistente.numero}
              Icon={Dumbbell}
              titolo={RESISTENTE.resistente.titolo}
              testo={test ? RESISTENTE.resistente.testoConVideo : RESISTENTE.resistente.testo}
              kicker={RESISTENTE.resistente.kicker}
              didascalia={RESISTENTE.resistente.didascalia}
              media={test ? <VideoSlot src={test} poster={media("id.testPoster")} alt={alt("id.testVideo")} muto className="aspect-[4/5]" /> : null}
            />
          </div>

          {vitaOk && (
            <div className="ng-pillar mt-6 p-7 lg:grid lg:grid-cols-[1fr_2fr] lg:items-center lg:gap-10">
              <div>
                <span className="ng-pillar__num">{RESISTENTE.ogniGiorno.numero}</span>
                <div className="ng-pillar__icon mb-6">
                  <Sun className="relative z-10 h-6 w-6" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-bold tracking-tight text-ink">{RESISTENTE.ogniGiorno.titolo}</h3>
                <p className="mt-3 text-base leading-relaxed text-ink-muted">{RESISTENTE.ogniGiorno.testo}</p>
              </div>
              <ClipLoop
                nome={RESISTENTE.ogniGiorno.etichettaRegione}
                scorre
                className="-mx-7 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-7 lg:mx-0 lg:mt-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0"
                classeClip="w-[62%] shrink-0 snap-start lg:w-auto"
                clips={vita.map(({ Icona, i, src }) => ({
                  src,
                  alt: alt(`id.vita${i + 1}`),
                  sotto: (
                    <div className="ng-pill mt-3 inline-flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-semibold text-ink">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-scuro text-white">
                        <Icona className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
                      </span>
                      {RESISTENTE.ogniGiorno.clip[i].etichetta}
                    </div>
                  ),
                }))}
              />
            </div>
          )}

          <div className="mt-12">
            <figure className="mx-auto max-w-5xl">
              <MediaSlot src={media("id.simboloFoto")} type="image" alt={alt("id.simboloFoto")} proporzione="aspect-[4/3] lg:aspect-[21/9]" nascondiSeVuoto />
              {media("id.simboloFoto") && <figcaption className="mt-3 text-center text-sm text-ink-muted">{RESISTENTE.simbolo.didascalia}</figcaption>}
            </figure>
            {/* la riga Hollywood: una sola volta in tutta la pagina, piana, senza immagini né accento */}
            <p className="mx-auto mt-10 max-w-2xl border-t border-ink/10 pt-8 text-center text-sm text-ink-muted md:text-base">{RESISTENTE.hollywood}</p>
          </div>
        </div>
      </section>

      {/* 5 · LA TABELLA E IL LIMITE */}
      <section aria-labelledby="tabella-titolo" className="relative bg-blueprint">
        {punto("Tabella", ["id.limiteVideo", "id.limitePoster"])}
        <div className={SEZIONE}>
          <Testata id="tabella-titolo" sopratitolo={TABELLA.sopratitolo} scuro>
            {TABELLA.h2}
          </Testata>
          <div className="mt-12 grid items-start gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
            <TabellaConfronto />
            <div>
              {media("id.limiteVideo") && (
                <div className="mb-6 max-w-[260px]">
                  <VideoSlot src={media("id.limiteVideo")} poster={media("id.limitePoster")} alt={alt("id.limiteVideo")} className="aspect-[4/5]" />
                </div>
              )}
              <p className="border-l border-brand pl-5 text-base leading-relaxed text-white/85 md:text-lg">
                <span className="font-semibold text-white">{TABELLA.limiteApertura}</span> {TABELLA.limite}
              </p>
            </div>
          </div>
          <p className="mx-auto mt-12 max-w-2xl text-center text-base text-white/75 md:text-lg">{TABELLA.chiusura}</p>
          <div className="mt-8">
            <Cta traccia="cta_tabella_clic" />
          </div>
        </div>
      </section>

      {/* 7 · LO STUDIO (prima della 6, anche nel DOM) */}
      <section aria-labelledby="studio-titolo" className="relative bg-white-grid">
        {punto("Studio", ["id.titolareFoto", "id.studio1", "id.studio2", "id.studio3", "id.studioVideo"])}
        <div className={SEZIONE}>
          <div className={studio.length || studioVideo ? "grid items-start gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16" : "mx-auto max-w-3xl text-center"}>
            <div>
              <div className="eyebrow">{STUDIO.sopratitolo}</div>
              <h2 id="studio-titolo" className={`${H2} text-ink`}>{STUDIO.h2}</h2>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted md:text-lg">{STUDIO.corpo}</p>
              {/* l'indirizzo è testo: non un link, non una mappa */}
              <div className="brackets mt-8 inline-flex items-center gap-3 px-6 py-4 text-left">
                <span className="br-tr" />
                <span className="br-bl" />
                <MapPin className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                <p className="text-base text-ink">
                  <strong>{STUDIO.indirizzo[0]}</strong>
                  <br />
                  {STUDIO.indirizzo[1]}
                </p>
              </div>
              {titolareFoto && (
                <div className="mt-8 max-w-xs">
                  <MediaSlot src={titolareFoto} type="image" alt={alt("id.titolareFoto")} proporzione="aspect-[4/5]" />
                </div>
              )}
            </div>
            {(studio.length > 0 || studioVideo) && (
              <div className="grid grid-cols-2 gap-4">
                {studio.map((s) => (
                  <figure key={s.chiave} className={s.i === 0 ? "col-span-2" : ""}>
                    <MediaSlot src={s.src} type="image" alt={alt(s.chiave)} proporzione={s.i === 0 ? "aspect-[16/10]" : "aspect-[4/3]"} />
                    <figcaption className="mt-2 text-sm text-ink-muted">{STUDIO.didascalie[s.i]}</figcaption>
                  </figure>
                ))}
                {studioVideo && (
                  <figure className="col-span-2">
                    <VideoSlot src={studioVideo} alt={alt("id.studioVideo")} titolo={STUDIO.didascalie[3]} muto className="aspect-video" />
                  </figure>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 6 · COME FUNZIONA */}
      <section aria-labelledby="passi-titolo" className="relative bg-blueprint">
        {punto("Come funziona", ["id.posaVideo", "id.posaPoster"])}
        <div className={SEZIONE}>
          <Testata id="passi-titolo" sopratitolo={PASSI.sopratitolo} scuro>
            {PASSI.h2}
          </Testata>
          <ol className="mt-12 grid gap-6 border-l border-brand/40 pl-5 lg:grid-cols-3 lg:border-l-0 lg:pl-0">
            {PASSI.passi.map((p, i) => {
              const Icona = ICONE_PASSI[i];
              return (
                <li key={p.titolo} className="rounded-md border border-white/10 bg-navy/60 p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-aurora text-4xl font-extrabold">{i + 1}</span>
                    <Icona className="h-5 w-5 text-brand" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-white">{p.titolo}</h3>
                  <p className="mt-2 text-base leading-relaxed text-white/85">{p.testo}</p>
                </li>
              );
            })}
          </ol>
          <p className="mx-auto mt-8 flex max-w-2xl items-start justify-center gap-2 text-base text-white/85">
            <MapPin className="mt-1 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            {PASSI.fuoriRoma}
          </p>
          {media("id.posaVideo") && (
            <figure className="mx-auto mt-10 max-w-3xl">
              <VideoSlot src={media("id.posaVideo")} poster={media("id.posaPoster")} alt={alt("id.posaVideo")} titolo={PASSI.videoDidascalia} muto className="aspect-video" />
              <figcaption className="mt-3 text-center text-sm text-white/75">{PASSI.videoDidascalia}</figcaption>
            </figure>
          )}
        </div>
      </section>

      {/* 9 · DOMANDE FREQUENTI */}
      <section aria-labelledby="faq-titolo" className="bg-light-panel">
        <div className={SEZIONE}>
          <Testata id="faq-titolo" sopratitolo={FAQ.sopratitolo}>
            {FAQ.h2}
          </Testata>
          <div className="mt-12">
            <FaqAccordion voci={FAQ.voci.map((v) => ({ q: v.q, a: v.a }))} />
          </div>
          <div data-barra-nascondi="vista" className="mt-10 text-center text-base text-ink-muted md:text-lg">
            {FAQ.rigaFinale}{" "}
            <a href="#prenota" data-track="cta_faq_clic" className="inline-flex min-h-11 items-center font-semibold text-brand underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-scuro">
              {BOTTONE}
            </a>
          </div>
        </div>
      </section>

      {/* 10 · PRENOTAZIONE */}
      <section id="prenota" aria-labelledby="prenota-titolo" data-barra-nascondi="vista" className="bg-blueprint scroll-mt-20">
        <div className={SEZIONE}>
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_28rem] lg:gap-16">
            <div>
              <div className="eyebrow">{PRENOTA.sopratitolo}</div>
              <h2 id="prenota-titolo" tabIndex={-1} className={`${H2} text-white outline-none`}>{PRENOTA.h2}</h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 md:text-lg">{PRENOTA.sottotitolo}</p>
              <ul className="mt-8 space-y-3">
                {PRENOTA.righe.map((r) => (
                  <li key={r} className="flex items-start gap-3 text-base text-white/85">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden="true" />
                    {r}
                  </li>
                ))}
              </ul>
              {titolareFoto && <div className="mt-8">{ritratto("h-[72px] w-[72px]")}</div>}
            </div>
            <div className="mx-auto w-full max-w-md">
              <BookingFunnel variant="dark" />
              <p className="mt-4 text-center text-sm text-white/75">
                {PRENOTA.privacy}{" "}
                <Link to="/privacy-policy" className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  Privacy
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <FooterId />
      <BarraPrenotaId />
      <CookieBanner />
    </main>
  );
}
