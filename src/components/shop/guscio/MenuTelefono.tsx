/** ── IL MENU DEL TELEFONO (VETRINA V1 · T82a) ──────────────────────────────────────────────────────────────
 *  Documento del Design §4.5.1: foglio a tutto schermo (fondo blueprint), righe alte 56 px: Patch pronte, Cura (si apre con le sue voci),
 *  Consulenza gratuita; in fondo il logo e «Hair Genius Labs · Roma». Chiusura con la X da 44 px, Esc o toccando fuori.
 *  Radix Dialog: fuoco intrappolato e Esc li dà lui. Questo file si scarica solo al primo tocco sul tasto del menu (`lazy` in `ShopHeader`),
 *  così Radix non pesa sulla prima pagina. Il fuoco alla chiusura lo restituisce `ShopHeader` (riduttore `foglio`): qui si impedisce a
 *  Radix di mandarlo dove capita e si chiama `onRendiFuoco`.
 *  Entra con `shop-foglio` e lo sfondo con `shop-dissolvi` (D100). shortcut: il Design dice «da destra», ma D100 ha solo il foglio dal basso e
 *  vieta altre animazioni; si cambia con una classe nuova di D100 (un compito di T74), non qui.
 *  «Consulenza gratuita» apre il pannello SOPRA il menu (z 60 contro 55): alla chiusura del pannello si torna al menu, il fuoco lo gestisce Radix.
 *  «Assistenza» e «Domande» del Design non ci sono: le pagine di servizio sono V2. */
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, X } from "lucide-react";
import logo from "@/assets/logo-hair-genius.png";
import { TESTI_PROVVISORI, TESTI_SHOP } from "@/landing/testi-shop";
import { SLUG_PATCH, type VoceCura } from "./ShopHeader";

export interface MenuTelefonoProps {
  aperto: boolean;
  /** Radix chiede di cambiare lo stato (X, Esc, tocco fuori). */
  onApertoChange: (aperto: boolean) => void;
  /** Titolo del foglio, per chi usa lo schermo parlato (non si vede). */
  titolo: string;
  /** Le voci di «Cura» (solo categorie con prodotti): nessuna = la riga «Cura» non c'è. */
  voci: readonly VoceCura[];
  /** Si è scelta una voce che porta in un'altra pagina: il foglio si chiude senza restituire il fuoco. */
  onNavigazione: () => void;
  onConsulenza: () => void;
  /** Il foglio si è chiuso: l'header rimette il fuoco sul suo tasto. */
  onRendiFuoco: () => void;
}

const T = TESTI_SHOP;
const GUSCIO = TESTI_PROVVISORI.guscio;
/** Una riga: alta 56 px, tutta larghezza, testo grande (il dito, non il puntatore). */
const RIGA = "shop-anello-scuro flex min-h-14 w-full items-center text-lg font-medium text-white";
const SEPARATORE = "border-b border-white/10";

export function MenuTelefono({ aperto, onApertoChange, titolo, voci, onNavigazione, onConsulenza, onRendiFuoco }: MenuTelefonoProps) {
  const [curaAperta, setCuraAperta] = useState(false);
  return (
    <Dialog.Root open={aperto} onOpenChange={onApertoChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="shop-dissolvi fixed inset-0 z-[55] bg-black/70" />
        <Dialog.Content
          // niente descrizione: il titolo basta (e Radix non protesta)
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            onRendiFuoco();
          }}
          className="shop-foglio bg-blueprint fixed inset-0 z-[55] flex flex-col text-white focus:outline-none"
        >
          <div className="flex h-14 shrink-0 items-center justify-end px-4 min-[360px]:px-6">
            <Dialog.Title className="sr-only">{titolo}</Dialog.Title>
            <Dialog.Close aria-label={GUSCIO.chiudiMenu} className="shop-anello-scuro inline-flex h-11 w-11 items-center justify-center rounded-md text-white hover:bg-white/10">
              <X className="h-6 w-6" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <nav aria-label={titolo} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 min-[360px]:px-6">
            <ul>
              <li className={SEPARATORE}>
                <Link to="/shop/c/$slug" params={{ slug: SLUG_PATCH }} onClick={onNavigazione} className={RIGA}>
                  {T.header.patch}
                </Link>
              </li>
              {voci.length > 0 && (
                <li className={SEPARATORE}>
                  <button
                    type="button"
                    aria-expanded={curaAperta}
                    aria-controls="menu-cura-voci"
                    onClick={() => setCuraAperta((a) => !a)}
                    className={`${RIGA} justify-between`}
                  >
                    {T.header.cura}
                    <ChevronDown className={`h-5 w-5 ${curaAperta ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  <ul id="menu-cura-voci" hidden={!curaAperta} className="pb-2">
                    {voci.map((v) => (
                      <li key={v.slug}>
                        <Link to="/shop/c/$slug" params={{ slug: v.slug }} onClick={onNavigazione} className={`${RIGA} pl-4 text-base font-normal text-white/85`}>
                          {v.nome}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              )}
              <li className={SEPARATORE}>
                <button type="button" aria-haspopup="dialog" onClick={onConsulenza} className={`${RIGA} underline underline-offset-4`}>
                  {T.header.consulenza}
                </button>
              </li>
            </ul>
          </nav>

          <div className="shrink-0 border-t border-white/10 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 min-[360px]:px-6">
            <img src={logo} alt={GUSCIO.logoAlt} className="h-6 w-auto select-none" draggable={false} />
            <p className="mt-3 text-sm text-white/75">{T.footer.riga}</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default MenuTelefono;
