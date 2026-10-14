/** ── LA PAGINA PROTOCOL (/protocol) ────────────────────────────────────────
 *  Ci arriva chi ha cliccato un annuncio o «Prenota la consulenza gratuita»
 *  dalla home. Una sola cosa da fare: lasciare nome, telefono e quando
 *  preferisce essere richiamato. Un solo bottone, ripetuto dopo «Cos'è» e
 *  dopo «Come funziona la consulenza», che scende al modulo.
 *
 *  Ordine (SPEC): testata · fa/non fa per te · cos'è · tenuta e manutenzione ·
 *  foto vere (solo con consenso) · come funziona la consulenza · 5 domande ·
 *  modulo corto.
 *
 *  ⚠️ Il modulo è `ModuloCorto` (compito C5). Finché non c'è, sta al suo posto
 *  `ModuloSegnaposto`: stessa firma, stessa ancora `#modulo`.
 *  ⚠️ La durata della consulenza non si mostra finché Operativo non dà il dato.
 *  La riga «Non fa per te» usa solo il limite vero che abbiamo (la manutenzione).
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState, type MouseEvent } from "react";
import { Check, Minus } from "lucide-react";
import { BarraConsulenza } from "@/components/landing/consulenza/BarraConsulenza";
import { CookieBanner } from "@/components/landing/CookieBanner";
import { Footer } from "@/components/landing/Footer";
import { EVENTO_SCELTA, leggiScelta } from "@/landing/consulenza/scelta";
import { ModuloCorto, type PuntoSito } from "./ModuloSegnaposto";
import { Bottone, ListaFaq, Marchio, Passi, Sezione, Titolo, vaiAlModulo } from "./pezzi";
import { fotoDaMostrare, rigaDurata, testoBottoneConsulenza } from "./pagine-regole";
import {
  BOTTONE_VARIANTE_B,
  DURATA_CONSULENZA,
  FOTO_CON_CONSENSO,
  INTERRUTTORI,
  NOME_PRODOTTO_ESTESO,
  TESTI_PROTOCOL,
} from "@/landing/testi-sito";
import { traccia, usaTracciamentoPagina, usaVariante } from "./traccia-provvisoria";

type Dove = "testata" | "cose" | "consulenza";

/** Il bottone unico della pagina: porta al modulo, qui sotto. */
function BottoneConsulenza({ dove, tono }: { dove: Dove; tono: "scuro" | "chiaro" }) {
  const variante = usaVariante();
  const quando = (e: MouseEvent<HTMLAnchorElement>) => {
    void traccia("click_bottone", { bottone: `${dove}_consulenza`, sezione: dove });
    vaiAlModulo(e);
  };
  return (
    <Bottone href="#modulo" tono={tono} onClick={quando}>
      {testoBottoneConsulenza(variante, TESTI_PROTOCOL.bottone, BOTTONE_VARIANTE_B)}
    </Bottone>
  );
}

/** «Fa per te se…»: le prime parole in neretto, il resto com'è nel testo approvato. */
function FraseConIncipit({ frase, incipit }: { frase: string; incipit: string }) {
  const resto = frase.startsWith(incipit) ? frase.slice(incipit.length) : frase;
  return (
    <p className="text-base leading-relaxed text-ink-muted">
      {frase.startsWith(incipit) ? (
        <strong className="font-semibold text-ink">{incipit}</strong>
      ) : null}
      {resto}
    </p>
  );
}

/** Da dove è arrivata la persona (home, barra…): serve al modulo per il punto d'ingresso. */
function usaPuntoIngresso(): PuntoSito {
  const [punto, setPunto] = useState<PuntoSito>("protocol");
  useEffect(() => {
    const leggi = () => setPunto(leggiScelta()?.punto ?? "protocol");
    leggi();
    window.addEventListener(EVENTO_SCELTA, leggi);
    return () => window.removeEventListener(EVENTO_SCELTA, leggi);
  }, []);
  return punto;
}

export function PaginaProtocol() {
  usaTracciamentoPagina("protocol");
  const punto = usaPuntoIngresso();
  const foto = fotoDaMostrare(INTERRUTTORI.fotoConConsenso, FOTO_CON_CONSENSO);
  const durata = rigaDurata(DURATA_CONSULENZA);
  const t = TESTI_PROTOCOL;

  return (
    <>
      <main id="top" className="min-h-screen overflow-x-hidden">
        {/* TESTATA */}
        <section className="bg-blueprint text-white">
          <div className="mx-auto max-w-5xl px-5 pb-14 pt-8 sm:px-6 lg:px-10 lg:pb-24 lg:pt-12">
            <Marchio nome={NOME_PRODOTTO_ESTESO} />
            <h1 className="mt-10 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:mt-16 lg:text-6xl">
              {t.titolo}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/80 text-pretty">
              {t.sottotitolo}
            </p>
            <div data-barra-nascondi="vista" className="mt-8 max-w-sm lg:mt-10">
              <BottoneConsulenza dove="testata" tono="scuro" />
            </div>
          </div>
        </section>

        {/* PER CHI È E PER CHI NO */}
        <Sezione id="per-chi" tono="pannello" titoloId="per-chi-titolo">
          <Titolo id="per-chi-titolo" tono="pannello">
            {t.perChi.titolo}
          </Titolo>
          <div className="mt-10 grid gap-8 md:grid-cols-2 md:gap-10">
            <div className="flex gap-4 border-t border-ink/15 pt-4">
              <Check
                className="mt-1 h-5 w-5 shrink-0 text-brand"
                strokeWidth={2.5}
                aria-hidden="true"
              />
              <FraseConIncipit frase={t.perChi.fa} incipit="Fa per te" />
            </div>
            <div className="flex gap-4 border-t border-ink/15 pt-4">
              <Minus
                className="mt-1 h-5 w-5 shrink-0 text-ink-muted"
                strokeWidth={2.5}
                aria-hidden="true"
              />
              <FraseConIncipit frase={t.perChi.nonFa} incipit="Non fa per te" />
            </div>
          </div>
        </Sezione>

        {/* COS'È */}
        <Sezione id="cose" tono="griglia" titoloId="cose-titolo">
          <Titolo id="cose-titolo" tono="griglia">
            {t.cosE.titolo}
          </Titolo>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-muted text-pretty">
            {t.cosE.testo}
          </p>
          <div data-barra-nascondi="vista" className="mt-8 max-w-sm">
            <BottoneConsulenza dove="cose" tono="chiaro" />
          </div>
        </Sezione>

        {/* TENUTA E MANUTENZIONE */}
        <Sezione id="tenuta" tono="scuro" titoloId="tenuta-titolo">
          <Titolo id="tenuta-titolo" tono="scuro">
            {t.tenuta.titolo}
          </Titolo>
          <div className="mt-10 grid gap-8 md:grid-cols-2 md:gap-10">
            {[t.tenuta.tenuta, t.tenuta.manutenzione].map((p) => (
              <div key={p.titolo} className="border-t border-white/25 pt-4">
                <h3 className="text-xl font-bold tracking-tight text-white">{p.titolo}</h3>
                <p className="mt-2 text-base leading-relaxed text-white/80">{p.testo}</p>
              </div>
            ))}
          </div>
        </Sezione>

        {/* FOTO VERE: la sezione c'è solo con interruttore acceso e foto con consenso scritto */}
        {foto.length > 0 ? (
          <Sezione id="foto" tono="griglia" titoloId="foto-titolo">
            <Titolo id="foto-titolo" tono="griglia">
              {t.foto.titolo}
            </Titolo>
            <ul className="mt-8 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3">
              {foto.map((f) => (
                <li key={f.src}>
                  <img
                    src={f.src}
                    alt={f.alt}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[4/5] w-full rounded-lg border border-ink/15 object-cover"
                  />
                </li>
              ))}
            </ul>
          </Sezione>
        ) : null}

        {/* COME FUNZIONA LA CONSULENZA */}
        <Sezione id="consulenza" tono="pannello" titoloId="consulenza-titolo">
          <Titolo id="consulenza-titolo" tono="pannello">
            {t.consulenza.titolo}
          </Titolo>
          <Passi voci={t.consulenza.passi} />
          {durata ? <p className="mt-6 text-base text-ink-muted">{durata}</p> : null}
          <div data-barra-nascondi="vista" className="mt-8 max-w-sm">
            <BottoneConsulenza dove="consulenza" tono="chiaro" />
          </div>
        </Sezione>

        {/* DOMANDE */}
        <Sezione id="domande" tono="griglia" titoloId="domande-titolo">
          <Titolo id="domande-titolo" tono="griglia">
            {t.faqTitolo}
          </Titolo>
          <ListaFaq voci={t.faq} />
        </Sezione>

        {/* MODULO */}
        <section className="bg-blueprint text-white">
          <div className="mx-auto max-w-xl px-5 py-14 sm:px-6 lg:py-24">
            <ModuloCorto
              origine="consulenza"
              punto={punto}
              problemaObbligatorio={false}
              titolo={t.modulo.titolo}
              variant="dark"
            />
          </div>
        </section>
      </main>
      <Footer />
      <BarraConsulenza provenienza="consulenza" />
      <CookieBanner />
    </>
  );
}
