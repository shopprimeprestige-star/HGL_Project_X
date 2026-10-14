/** ── LA HOME A DUE STRADE ──────────────────────────────────────────────────
 *  Chi arriva da Instagram, TikTok o dalle ads deve capire in un secondo che
 *  cosa può fare: comprare lo stock oppure parlare con noi. Per questo nel
 *  primo schermo ci sono il titolo e DUE bottoni della stessa misura, senza
 *  prezzi, conto alla rovescia o «ultimi posti».
 *
 *  Ordine (SPEC): marchio · titolo · due bottoni · una riga su cos'è ·
 *  «Da dove vuoi partire?» con le due carte · tre prove · come funziona ·
 *  5 domande · chiusura con gli stessi due bottoni · barra della consulenza.
 *
 *  ⚠️ Le foto con consenso: la sezione non esiste nella pagina finché il
 *  titolare non accende l'interruttore E ci sono foto vere. Mai foto
 *  d'archivio al posto.
 *  ⚠️ Il calendario NON si monta qui: la prenotazione sta su /protocol. Per
 *  questo la pagina salva da sola i dati della fonte (vedi
 *  `traccia-provvisoria.ts`): senza, un annuncio che atterra qui perderebbe
 *  utm e fbclid prima di arrivare al modulo.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { MouseEvent } from "react";
import { BarraConsulenza } from "@/components/landing/consulenza/BarraConsulenza";
import { CookieBanner } from "@/components/landing/CookieBanner";
import { Footer } from "@/components/landing/Footer";
import { salvaScelta } from "@/landing/consulenza/scelta";
import {
  Bottone,
  GrigliaBottoni,
  ListaFaq,
  Marchio,
  Passi,
  Sezione,
  Titolo,
  vaiDopo,
} from "./pezzi";
import { fotoDaMostrare, testoBottoneConsulenza } from "./pagine-regole";
import {
  BOTTONE_VARIANTE_B,
  FOTO_CON_CONSENSO,
  INTERRUTTORI,
  LINK_CATALOGO,
  LINK_CONSULENZA,
  TESTI_HOME,
} from "@/landing/testi-sito";
import { traccia, usaTracciamentoPagina, usaVariante } from "./traccia-provvisoria";

type Dove = "testata" | "percorsi" | "chiusura";

function BottoneCatalogo({ dove, tono }: { dove: Dove; tono: "scuro" | "chiaro" }) {
  const quando = (e: MouseEvent<HTMLAnchorElement>) =>
    vaiDopo(e, LINK_CATALOGO, () =>
      Promise.all([
        traccia("click_bottone", { bottone: `${dove}_catalogo`, sezione: dove }),
        traccia("scelta_percorso", { percorso: "catalogo" }),
      ]),
    );
  return (
    <Bottone href={LINK_CATALOGO} tono={tono} onClick={quando}>
      {TESTI_HOME.bottoneCatalogo}
    </Bottone>
  );
}

function BottoneConsulenza({ dove, tono }: { dove: Dove; tono: "scuro" | "chiaro" }) {
  const variante = usaVariante();
  const quando = (e: MouseEvent<HTMLAnchorElement>) => {
    //  La scelta ricordata fa arrivare il lead con il punto d'ingresso «home».
    salvaScelta({ problema: null, provenienza: "consulenza", punto: "home" });
    vaiDopo(e, LINK_CONSULENZA, () =>
      Promise.all([
        traccia("click_bottone", { bottone: `${dove}_consulenza`, sezione: dove }),
        traccia("scelta_percorso", { percorso: "consulenza" }),
      ]),
    );
  };
  return (
    <Bottone href={LINK_CONSULENZA} tono={tono} onClick={quando}>
      {testoBottoneConsulenza(variante, TESTI_HOME.bottoneConsulenza, BOTTONE_VARIANTE_B)}
    </Bottone>
  );
}

export function HomeNuova() {
  usaTracciamentoPagina("home");
  const foto = fotoDaMostrare(INTERRUTTORI.fotoConConsenso, FOTO_CON_CONSENSO);
  const { percorsi, prove, comeFunziona, chiusura } = TESTI_HOME;
  const [cartaStock, cartaProtocol] = percorsi.carte;

  return (
    <>
      <main id="top" className="min-h-screen overflow-x-hidden">
        {/* TESTATA: titolo e due bottoni nel primo schermo */}
        <section className="bg-blueprint text-white">
          <div className="mx-auto max-w-5xl px-5 pb-14 pt-8 sm:px-6 lg:px-10 lg:pb-24 lg:pt-12">
            <Marchio />
            <h1 className="mt-10 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:mt-16 lg:text-6xl">
              {TESTI_HOME.titolo}
            </h1>
            <div className="mt-8 lg:mt-10">
              <GrigliaBottoni>
                <BottoneCatalogo dove="testata" tono="scuro" />
                <BottoneConsulenza dove="testata" tono="scuro" />
              </GrigliaBottoni>
            </div>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-white/80">{TESTI_HOME.riga}</p>
          </div>
        </section>

        {/* DA DOVE VUOI PARTIRE: le due carte, di pari peso */}
        <Sezione id="percorsi" tono="pannello" titoloId="percorsi-titolo" nascondiBarra>
          <Titolo id="percorsi-titolo" tono="pannello">
            {percorsi.titolo}
          </Titolo>
          <p className="mt-4 max-w-2xl text-lg font-semibold leading-snug text-ink">
            {percorsi.frase}
          </p>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-muted text-pretty">
            {percorsi.sottotitolo}
          </p>
          <ul className="mt-10 grid list-none gap-4 p-0 md:grid-cols-2 lg:gap-6">
            {[
              { carta: cartaStock, bottone: <BottoneCatalogo dove="percorsi" tono="chiaro" /> },
              {
                carta: cartaProtocol,
                bottone: <BottoneConsulenza dove="percorsi" tono="chiaro" />,
              },
            ].map(({ carta, bottone }) => (
              <li
                key={carta.id}
                className="flex flex-col rounded-xl border border-ink/15 bg-white p-6 lg:p-8"
              >
                <h3 className="text-2xl font-bold tracking-tight text-ink">{carta.titolo}</h3>
                <p className="mt-3 text-lg font-semibold leading-snug text-ink">{carta.frase}</p>
                <p className="mt-2 text-base leading-relaxed text-ink-muted">{carta.testo}</p>
                <div className="mt-auto pt-8">{bottone}</div>
              </li>
            ))}
          </ul>
        </Sezione>

        {/* TRE PROVE: tenuta, manutenzione, foto vere (solo con consenso) */}
        <Sezione id="prove" tono="griglia" titoloId="prove-titolo">
          <Titolo id="prove-titolo" tono="griglia">
            {prove.titolo}
          </Titolo>
          <div className="mt-10 grid gap-8 md:grid-cols-2 md:gap-10">
            {[prove.tenuta, prove.manutenzione].map((p) => (
              <div key={p.titolo} className="border-t border-ink/15 pt-4">
                <h3 className="text-xl font-bold tracking-tight text-ink">{p.titolo}</h3>
                <p className="mt-2 text-base leading-relaxed text-ink-muted">{p.testo}</p>
              </div>
            ))}
          </div>
          {foto.length > 0 ? (
            <div className="mt-10 border-t border-ink/15 pt-4">
              <h3 className="text-xl font-bold tracking-tight text-ink">{prove.foto.titolo}</h3>
              <p className="mt-2 text-base leading-relaxed text-ink-muted">{prove.foto.testo}</p>
              <ul className="mt-6 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3">
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
            </div>
          ) : null}
        </Sezione>

        {/* COME FUNZIONA */}
        <Sezione id="come-funziona" tono="pannello" titoloId="come-titolo">
          <Titolo id="come-titolo" tono="pannello">
            {comeFunziona.titolo}
          </Titolo>
          <Passi voci={comeFunziona.passi} />
        </Sezione>

        {/* DOMANDE */}
        <Sezione id="domande" tono="griglia" titoloId="domande-titolo">
          <Titolo id="domande-titolo" tono="griglia">
            {TESTI_HOME.faqTitolo}
          </Titolo>
          <ListaFaq voci={TESTI_HOME.faq} />
        </Sezione>

        {/* CHIUSURA: gli stessi due bottoni */}
        <Sezione id="chiusura" tono="scuro" titoloId="chiusura-titolo" nascondiBarra>
          <Titolo id="chiusura-titolo" tono="scuro">
            {chiusura.titolo}
          </Titolo>
          <div className="mt-8">
            <GrigliaBottoni>
              <BottoneCatalogo dove="chiusura" tono="scuro" />
              <BottoneConsulenza dove="chiusura" tono="scuro" />
            </GrigliaBottoni>
          </div>
        </Sezione>
      </main>
      <Footer />
      <BarraConsulenza provenienza="consulenza" />
      <CookieBanner />
    </>
  );
}
