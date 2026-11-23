/** ── HeroShop · VETRINA V1 · T91 ──────────────────────────────────────────────
 *  L'hero della home dello shop (documento §3.3 e §4.5.2), su fondo blueprint con la lenta deriva del riflettore (spenta col movimento ridotto).
 *  Dal telefono in su: sopratitolo, H1 con UNA parola in accento, sottotitolo, [Patch pronte] pieno chiaro e (Cura e manutenzione) di contorno,
 *  il ritratto tondo con nome e riga dello studio (D96), poi la foto e DOPO la foto la fascia di fiducia. Niente ricerca (l'header ce l'ha già).
 *  Sul computer due colonne (testo | foto) e la fascia a tutta larghezza in fondo. Senza `shop.heroFoto` (o senza la sua descrizione): una colonna centrata.
 *  Tutto viene dal contenuto dello shop (T80): testi con `testiDi` (uno svuotato nel CRM non si disegna), foto con `slotUsabile`, nome con `confermatiDa`,
 *  disposizione con `pianoHero` (T76), voci con `vociDellaFascia`. Gli indirizzi dei due bottoni sono quelli del carrello vuoto (T79).
 *  La foto dell'hero è l'unica `eager` della home (LCP) e ha il riquadro 4:5 già misurato: nessun salto. */
import { Link } from "@tanstack/react-router";
import { RichText } from "@/components/landing/RichText";
import { FotoShop } from "@/components/shop/FotoShop";
import { FasciaFiducia, vociDellaFascia } from "@/components/shop/home/FasciaFiducia";
import { riempi } from "@/landing/testi-shop";
import type { SpedizionePubblica } from "@/shop/cassa/spedizione";
import { HREF_CURA, HREF_PATCH_PRONTE } from "@/shop/cms/vetrina-carrello";
import { confermatiDa, mediaDi, slotUsabile, testiDi } from "@/shop/cms/vetrina-contenuto";
import { pianoHero } from "@/shop/cms/vetrina-home";

/** Notte `#0A1430` su bianco: 18,2:1. 48 px sul telefono, 56 dal computer. */
const BOTTONE = "shop-anello-scuro inline-flex min-h-12 w-full items-center justify-center rounded-md px-8 text-base font-semibold transition-colors sm:w-auto lg:min-h-14";
const PIENO = `${BOTTONE} bg-white text-[#0A1430] hover:bg-[#EEF2FF]`;
const CONTORNO = `${BOTTONE} border-2 border-white text-white hover:bg-white/10`;

export function HeroShop({ contenuto, tariffa }: { contenuto?: unknown; tariffa?: SpedizionePubblica | null }) {
  const t = testiDi(contenuto);
  const media = mediaDi(contenuto);
  const firmatario = confermatiDa(contenuto).firmatario;
  const foto = slotUsabile(media["shop.heroFoto"], t["shop.heroFoto.alt"]);
  // Il ritratto è del titolare stesso: non serve la liberatoria dei clienti (D96 chiede solo foto e nome confermato).
  const titolare = slotUsabile(media["shop.titolareFoto"], firmatario ? riempi(t["shop.titolareFoto.alt"] ?? "", { nome: firmatario }) : null);
  const piano = pianoHero({ heroFoto: foto?.src, titolareFoto: titolare?.src, firmatario });
  const centrato = piano.colonne === 1;
  const didascalia = piano.ritratto && t["shop.hero.didascalia"] ? riempi(t["shop.hero.didascalia"], { nome: piano.nome }) : null;
  const riga = t["shop.hero.riga"];
  const h1 = t["shop.hero.h1"];
  const cta1 = t["shop.hero.cta1"];
  const cta2 = t["shop.hero.cta2"];
  return (
    <section className="bg-blueprint relative overflow-hidden before:pointer-events-none before:absolute before:inset-[-20%] before:content-[''] before:bg-[radial-gradient(600px_circle_at_30%_20%,var(--brand-velo-22)_0%,transparent_60%)] before:animate-[spotlight-drift_12s_ease-in-out_infinite] motion-reduce:before:animate-none">
      <div
        className={`relative mx-auto px-6 pb-12 pt-10 lg:px-10 lg:pb-16 lg:pt-16 ${
          centrato ? "flex max-w-3xl flex-col items-center text-center" : "grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16"
        }`}
      >
        <div className={centrato ? "flex flex-col items-center" : ""}>
          {t["shop.hero.eyebrow"] && <p className="eyebrow">{t["shop.hero.eyebrow"]}</p>}
          {h1 && (
            <h1 className="mt-4 text-balance text-3xl font-bold leading-[1.08] tracking-tight text-white md:text-5xl lg:text-6xl">
              <RichText value={h1} highlightClass="text-aurora" />
            </h1>
          )}
          {t["shop.hero.sottotitolo"] && (
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 md:text-lg">{t["shop.hero.sottotitolo"]}</p>
          )}
          {(cta1 || cta2) && (
            <div className={`mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row ${centrato ? "justify-center" : ""}`}>
              {cta1 && (
                <Link to={HREF_PATCH_PRONTE} className={PIENO}>
                  {cta1}
                </Link>
              )}
              {cta2 && (
                <Link to={HREF_CURA} className={CONTORNO}>
                  {cta2}
                </Link>
              )}
            </div>
          )}
          {(titolare && piano.ritratto) || riga ? (
            <div className="mt-8 flex items-center gap-3 text-left">
              {titolare && piano.ritratto && <FotoShop src={titolare.src} alt={titolare.alt} uso="ritratto" className="w-14 shrink-0 rounded-full" />}
              <div>
                {didascalia && <p className="text-sm font-semibold text-white">{didascalia}</p>}
                {riga && <p className="text-sm text-white/75">{riga}</p>}
              </div>
            </div>
          ) : null}
        </div>
        {foto && (
          <div className="brackets mx-auto w-full max-w-[440px] before:z-10 after:z-10 lg:ml-auto lg:mr-0">
            <FotoShop src={foto.src} alt={foto.alt} uso="hero" prima className="rounded-md" />
            <span className="br-tr z-10" aria-hidden="true" />
            <span className="br-bl z-10" aria-hidden="true" />
          </div>
        )}
        <FasciaFiducia voci={vociDellaFascia(contenuto, tariffa)} className={centrato ? "justify-center" : "lg:col-span-2"} />
      </div>
    </section>
  );
}
