/** Piè di pagina ridotto: logo, indirizzo, ragione sociale e P.IVA (già pubblici nel Footer della home),
 *  Privacy, Cookie, Termini. Nessuno slogan, nessuna mail o telefono cliccabile, nessun altro link. */
import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo-hair-genius.png";
import { FOOTER, MARCHIO } from "@/landing/testi-invisible-derm";

export function FooterId() {
  return (
    <footer className="bg-footer border-t border-white/10 text-white/75">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
        <img src={logo} alt={MARCHIO.altLogo} className="h-10 w-auto select-none" draggable={false} />
        <p className="mt-5 text-sm text-white">{FOOTER.riga}</p>
        <p className="mt-1 text-sm text-white/75">{FOOTER.ragioneSociale}</p>
        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {(
            [
              ["/privacy-policy", "Privacy"],
              ["/cookie-policy", "Cookie"],
              ["/termini-e-condizioni", "Termini"],
            ] as const
          ).map(([a, testo]) => (
            <li key={a}>
              <Link to={a} className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                {testo}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
