/** I tre ruoli dei bottoni della pagina `/soluzioni` (4.1), mai altri.
 *  Colori, misure e fuoco stanno in `styles.css` sotto `.tema-soluzioni`: qui nessun colore scritto a mano.
 *  - primario: l'unico blu pieno per schermata («Prenota la consulenza gratuita»);
 *  - contorno: «Che cos'è Invisible Derm?» / «Chiudi la spiegazione» (l'unico che apre qualcosa sul posto);
 *  - link d'azione: testo + sottolineatura, per le azioni piccole. */
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { ArrowRight, Plus } from "lucide-react";

function unisci(...classi: Array<string | undefined | false>): string {
  return classi.filter(Boolean).join(" ");
}

/** `data-barra-nascondi="fondo"`: la barra delle patch si fa da parte quando questo bottone le arriva sopra. */
export function BottonePrimario({
  className,
  type = "button",
  children,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      data-barra-nascondi="fondo"
      className={unisci("sol-btn-primario", className)}
      {...resto}
    >
      {children}
    </button>
  );
}

/** Il «+» ruota in «×» quando `aria-expanded` è "true": lo passa chi lo usa, come per ogni bottone che apre. */
export function BottoneContorno({
  className,
  type = "button",
  children,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={unisci("sol-btn-contorno", className)} {...resto}>
      <Plus className="sol-btn-icona" aria-hidden="true" strokeWidth={2} />
      <span>{children}</span>
    </button>
  );
}

type PropsLink = { freccia?: boolean; children: ReactNode; className?: string };

/** Con `href` è un collegamento, senza è un bottone (apre il foglio). `freccia`: aggiunge «→» (di base no: il testo può già averla). */
export function LinkAzione(
  props: PropsLink &
    (
      | ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement>)
      | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)
    ),
) {
  const { freccia = false, className, children, ...resto } = props;
  const dentro = (
    <>
      <span>{children}</span>
      {freccia && <ArrowRight className="sol-link-freccia" aria-hidden="true" strokeWidth={2} />}
    </>
  );
  if (typeof resto.href === "string") {
    return (
      <a
        className={unisci("sol-link", className)}
        {...(resto as AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {dentro}
      </a>
    );
  }
  const { type = "button", ...bottone } = resto as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type={type} className={unisci("sol-link", className)} {...bottone}>
      {dentro}
    </button>
  );
}
