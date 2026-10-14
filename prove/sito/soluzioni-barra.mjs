/** ── PROVA S4.3 · LA BARRA DELLE PATCH (`/soluzioni`) ──────────────────────
 *  Quando la barra si nasconde è UNA funzione pura, `barraNascosta`: la guardiamo caso per caso.
 *  Solo tre motivi (4.4): foglio del modulo aperto · video del titolare che gira · su telefono un
 *  elemento `data-barra-nascondi="fondo"` negli ultimi 60 px. Mai lo scorrimento.
 *  I casi di `BarraConsulenza` (fondo dentro/fuori dalla zona, elementi a misura zero ignorati) ci sono tutti.
 *  Il disegno vero (presente dal primo disegno, 44 px, foglio che la copre) lo guarda Playwright (S4.5).
 *  ───────────────────────────────────────────────────────────────────────── */
import { carica, leggi, nuovaProva } from "./_comune.mjs";

const { c, vero, finisci } = nuovaProva("barra delle patch");
const Z = await carica("src/landing/sito/soluzioni/usaZonaBarra.ts", "zona-barra", {
  reactVero: true,
});
const { barraNascosta } = Z;

const ALTO = 844;
const MARGINE = 60;
const el = (tipo, top, bottom, w = 300, h = bottom - top) => ({
  tipo,
  top,
  bottom,
  width: w,
  height: h,
});
const base = {
  elementi: [],
  alto: ALTO,
  margine: MARGINE,
  telefono: true,
  foglioAperto: false,
  videoGira: false,
};
const nasc = (o) => barraNascosta({ ...base, ...o });

/* ── 1. Nessun motivo: la barra c'è ─────────────────────────────────────── */
c("pagina vuota: visibile", false, nasc({}));
c("elementi fuori zona: visibile", false, nasc({ elementi: [el("fondo", 400, 456)] }));

/* ── 2. Foglio aperto e video che gira: sempre, telefono e computer ─────── */
c("foglio aperto (telefono): nascosta", true, nasc({ foglioAperto: true }));
c(
  "foglio aperto (computer): nascosta (la pagina sotto è inert)",
  true,
  nasc({ foglioAperto: true, telefono: false }),
);
c("video che gira (telefono): nascosta", true, nasc({ videoGira: true }));
c("video che gira (computer): nascosta", true, nasc({ videoGira: true, telefono: false }));

/* ── 3. Il bottone blu negli ultimi 60 px (solo telefono) ───────────────── */
const zona = ALTO - MARGINE; // 784
c(
  "fondo: bordo basso appena dentro la zona",
  true,
  nasc({ elementi: [el("fondo", 740, zona + 1)] }),
);
c(
  "fondo: bordo basso esattamente sul limite (non entra)",
  false,
  nasc({ elementi: [el("fondo", 728, zona)] }),
);
c("fondo: tutto dentro la zona", true, nasc({ elementi: [el("fondo", 790, 846 - 2)] }));
c("fondo: a cavallo del bordo dello schermo", true, nasc({ elementi: [el("fondo", 800, 856)] }));
c(
  "fondo: tutto sotto lo schermo (non ancora entrato)",
  false,
  nasc({ elementi: [el("fondo", ALTO, ALTO + 56)] }),
);
c(
  "fondo: tutto sopra lo schermo (già passato)",
  false,
  nasc({ elementi: [el("fondo", -120, -10)] }),
);
c("fondo: sopra la zona, con aria", false, nasc({ elementi: [el("fondo", 600, 700)] }));
c("torna visibile appena esce dalla zona", false, nasc({ elementi: [el("fondo", 600, 660)] }));
c(
  "fondo su computer: ignorato",
  false,
  nasc({ telefono: false, elementi: [el("fondo", 740, 800)] }),
);
c(
  "elemento a misura zero (larghezza e altezza 0): ignorato",
  false,
  nasc({ elementi: [el("fondo", 800, 800, 0, 0)] }),
);
c(
  "solo l'altezza è zero (largo ma piatto): conta, come in BarraConsulenza",
  true,
  nasc({ elementi: [el("fondo", 800, 800, 300, 0)] }),
);
c(
  "margine più grande (barra + area sicura iPhone): la zona si allarga",
  true,
  nasc({ margine: 94, elementi: [el("fondo", 700, 760)] }),
);
c(
  "un solo elemento in zona fra molti: nascosta",
  true,
  nasc({ elementi: [el("fondo", 100, 160), el("fondo", 760, 820), el("fondo", 300, 360)] }),
);

/* ── 4. Gli altri tipi non contano: la barra non si nasconde «per vista» ─── */
c(
  "elemento «vista» a schermo (il modulo): ignorato",
  false,
  nasc({ elementi: [el("vista", 100, 700)] }),
);
c("elemento senza tipo: ignorato", false, nasc({ elementi: [el(undefined, 740, 800)] }));

/* ── 5. Mai lo scorrimento ──────────────────────────────────────────────── */
{
  const sorgenteFn = barraNascosta.toString();
  vero(
    "barraNascosta non guarda lo scorrimento (nessun scroll/offset/delta)",
    !/scroll|pageYOffset|deltaY|direzione/i.test(sorgenteFn),
  );
  const quadro = { ...base, elementi: [el("fondo", 300, 360)] };
  c(
    "stessi elementi, stesso risultato (nessuno stato nascosto)",
    barraNascosta(quadro),
    barraNascosta({ ...quadro }),
  );
  const codice = leggi("src/landing/sito/soluzioni/usaZonaBarra.ts").replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    "",
  );
  vero(
    "il gancio non confronta posizioni di scorrimento (scrollY/scrollTop/pageYOffset)",
    !/scrollY|scrollTop|pageYOffset|lastScroll|prevScroll/.test(codice),
  );
  vero(
    "lo scorrimento serve solo a rimisurare, con requestAnimationFrame",
    /addEventListener\("scroll"/.test(codice) && /requestAnimationFrame/.test(codice),
  );
  vero("il gancio legge video e foglio da stato-pagina", /usaStatoPagina/.test(codice));
  vero(
    "il gancio ascolta anche resize e il cambio di altezza della pagina",
    /addEventListener\("resize"/.test(codice) && /ResizeObserver/.test(codice),
  );
  vero(
    "il gancio rimuove tutto allo smontaggio",
    /removeEventListener\("scroll"/.test(codice) &&
      /cancelAnimationFrame/.test(codice) &&
      /disconnect/.test(codice),
  );
}

/* ── 6. Il disegno della barra: cosa il sorgente promette ───────────────── */
{
  const barra = leggi("src/landing/sito/soluzioni/BarraPatch.tsx");
  const codice = barra.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  vero(
    "va a LINK_CATALOGO (una costante, mai un indirizzo scritto qui)",
    /LINK_CATALOGO/.test(codice) && !/["'`]\/shop["'`]/.test(codice),
  );
  vero("evento barra_shop_clic", /barra_shop_clic/.test(codice));
  vero(
    "tutta la barra è il collegamento (un solo <a>)",
    (codice.match(/<a\b/g) ?? []).length === 1,
  );
  vero(
    "nascosta = invisible + inert (fuori dal Tab)",
    /inert=\{/.test(codice) && /invisible/.test(codice),
  );
  vero(
    "dissolvenza di 150 ms, spenta con «riduci movimento»",
    /duration-150/.test(codice) && /motion-reduce:transition-none/.test(codice),
  );
  vero(
    "non parte nascosta: nessuno stato iniziale «nascosta = true» né useEffect che la mostra dopo",
    !/useState\(true\)/.test(codice) && !/setMontata/.test(codice),
  );
  vero("niente blu pieno: nessun #0F90FE", !/#0F90FE/i.test(codice));
  vero(
    "pillola a contorno 32 px su fondo #111C3D, filetto #C9D6FF",
    /h-8/.test(codice) &&
      /#111C3D/i.test(codice) &&
      /#C9D6FF/i.test(codice) &&
      /border-\[1\.5px\]/.test(codice),
  );
  vero(
    "sul telefono riserva lo spazio in fondo (44 px + area sicura)",
    /data-barra-spazio/.test(codice) && /safe-area-inset-bottom/.test(codice),
  );
  vero("sul computer sta in alto, 44 px", /lg:top-0/.test(codice) && /lg:h-11/.test(codice));
  vero("niente X: è fissa per brief", !/lucide-react/.test(codice) && !/chiudi/i.test(codice));
  vero("usa il gancio comune", /usaZonaBarra\(/.test(codice));
}

finisci();
