/** ── PIÈ DI PAGINA DELLO SHOP (V1 · T83, documento §3.2 e §4.5.11) ───────────
 *  Logo, «Hair Genius Labs · Roma», ragione sociale e P.IVA. NESSUN indirizzo (decisione del titolare, 20/11). Due colonne di link, e SOLO a
 *  pagine che esistono (V1-H4): «Lo shop» (patch, cura) e «Legale» (termini, privacy, cookie). «Aiuto» non si monta in V1: le sue pagine
 *  (spedizioni e resi, garanzia, assistenza, domande) non ci sono. Poi il comando che riapre la scelta dei cookie e il diritto d'autore.
 *  Testo `white/75` (mai sotto `white/60`). Righe da 44 px, niente accordion: i link nascosti non si trovano.
 *  «Consulenza gratuita» non è una pagina (apre il flusso che esiste): c'è solo se chi monta il piè di pagina passa `consulenza`. */
import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo-hair-genius.png";
import { GestisciCookie } from "@/components/tracciamento/GestisciCookie";
import { TESTI_PROVVISORI, TESTI_SHOP, riempi } from "@/landing/testi-shop";
import { HREF_CURA, HREF_PATCH_PRONTE } from "@/shop/cms/vetrina-carrello";

const LINK =
  "inline-flex min-h-11 items-center underline underline-offset-4 hover:text-white shop-anello-scuro";

/** I link, in un elenco chiuso: ogni voce è una rotta che esiste (la prova `shop-footer-stati` lo controlla sulle rotte vere). */
const COLONNA_SHOP = [
  { testo: TESTI_SHOP.header.patch, href: HREF_PATCH_PRONTE },
  { testo: TESTI_SHOP.header.cura, href: HREF_CURA },
];
const COLONNA_LEGALE = [
  { testo: TESTI_SHOP.footer.termini, href: "/termini-e-condizioni" },
  { testo: TESTI_SHOP.footer.privacy, href: "/privacy-policy" },
  { testo: TESTI_SHOP.footer.cookie, href: "/cookie-policy" },
];

function Colonna({ id, titolo, link, azione }: { id: string; titolo: string; link: { testo: string; href: string }[]; azione?: { testo: string; fai: () => void } }) {
  return (
    <nav aria-labelledby={id}>
      <p id={id} className="text-sm font-semibold text-white">
        {titolo}
      </p>
      <ul className="mt-2 text-sm">
        {link.map((l) => (
          <li key={l.href}>
            <Link to={l.href} className={LINK}>
              {l.testo}
            </Link>
          </li>
        ))}
        {azione && (
          <li>
            <button type="button" onClick={azione.fai} className={`${LINK} cursor-pointer`}>
              {azione.testo}
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}

export interface FooterShopProps {
  /** Apre la consulenza (lo stesso gesto della voce nell'header). Senza, la voce non c'è. */
  consulenza?: () => void;
  /** L'anno del diritto d'autore; di norma quello di oggi. */
  anno?: number;
}

export function FooterShop({ consulenza, anno = new Date().getFullYear() }: FooterShopProps) {
  return (
    <footer className="bg-footer border-t border-white/10 text-white/75">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <img src={logo} alt={TESTI_PROVVISORI.guscio.logoAlt} width={1920} height={453} className="h-10 w-auto select-none" draggable={false} />
            <p className="mt-5 text-sm text-white">{TESTI_SHOP.footer.riga}</p>
            <p className="mt-1 text-sm">{TESTI_SHOP.footer.ragioneSociale}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:gap-x-16">
            <Colonna id="footer-lo-shop" titolo={TESTI_SHOP.footer.colonnaShop} link={COLONNA_SHOP} azione={consulenza && { testo: TESTI_SHOP.header.consulenza, fai: consulenza }} />
            <Colonna id="footer-legale" titolo={TESTI_SHOP.footer.colonnaLegale} link={COLONNA_LEGALE} />
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-1 border-t border-white/10 pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <GestisciCookie />
          <p>{riempi(TESTI_SHOP.footer.copyright, { anno })}</p>
        </div>
      </div>
    </footer>
  );
}
