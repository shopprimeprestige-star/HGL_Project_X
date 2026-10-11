import { Mail, Phone } from "lucide-react";
import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo-hair-genius.png";

export function Footer() {
  return (
    <footer className="bg-footer text-white/75 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <img
              src={logo}
              alt="Hair Genius Labs"
              className="h-12 w-auto select-none"
              draggable={false}
            />

            <p className="mt-6 text-white text-base">
              Indistinguibile dalla cute.{" "}
              <span className="font-bold">Anche a distanza di contatto.</span>
            </p>

            <div className="mt-6 text-xs text-white/55 leading-relaxed">
              <div className="font-semibold text-white/80">HAIR GENIUS LABS SRLS</div>
              <div>Via degli Scipioni 132, 00192 Roma (RM)</div>
              <div>P.IVA 18486531009</div>
            </div>
          </div>

          {/* Contatti */}
          <div>
            <div className="text-[0.7rem] tracking-[0.22em] uppercase text-brand font-semibold mb-5">
              Contatti
            </div>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-brand shrink-0" />
                <a
                  href="mailto:hairgeniuslabs@gmail.com"
                  className="hover:text-brand break-all"
                >
                  hairgeniuslabs@gmail.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-brand shrink-0" />
                <a href="tel:+393793113802" className="hover:text-brand">
                  +39 379 311 3802
                </a>
              </li>
            </ul>

          </div>

          {/* Legal */}
          <div>
            <div className="text-[0.7rem] tracking-[0.22em] uppercase text-brand font-semibold mb-5">
              Legale
            </div>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/privacy-policy" className="hover:text-brand">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/cookie-policy" className="hover:text-brand">
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link to="/termini-e-condizioni" className="hover:text-brand">
                  Termini e condizioni
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3 text-[0.7rem] tracking-[0.18em] uppercase text-white/45">
          <div>© {new Date().getFullYear()} Hair Genius Labs SRLS · Tutti i diritti riservati</div>
          <div>P.IVA 18486531009</div>
        </div>
      </div>
    </footer>
  );
}
