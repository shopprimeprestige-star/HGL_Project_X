/** ── I TAGLI SI GUARDANO, NON SI LEGGONO ───────────────────────────────────
 *
 *  Otto riquadri con scritto «Sfumato alto» e «Medio pettinato» chiedono a chi
 *  legge di immaginarsi un taglio a partire da due parole — e due parole non
 *  bastano: «medio mosso» vuol dire una cosa diversa per ognuno. Un disegno la
 *  scelta la fa fare in un secondo, e soprattutto la fa fare GIUSTA: quello che
 *  si vede è quello che arriva.
 *
 *  ── ⚠️ PERCHÉ DISEGNI E NON FOTOGRAFIE ───────────────────────────────────
 *  Una fotografia di un taglio è la fotografia della testa di QUALCUNO. Prenderla
 *  da internet vuol dire mettere la faccia di una persona vera dentro il sito di
 *  un centro tricologico, accanto a un tasto che dice «guardati così»: è un
 *  guaio legale e una scorrettezza, e non si risolve cercando meglio.
 *  Questi disegni invece sono nostri, non pesano niente, non si scaricano da
 *  nessun server e ci sono sempre — anche quando la rete non c'è.
 *  ⚠️ E SI POSSONO SOSTITUIRE: se un giorno ci sono le foto vere dei clienti
 *   (con la loro liberatoria), basta passare `foto` alla scheda del taglio e il
 *   disegno si fa da parte. La strada è già aperta, vedi `SchedaTaglio`.
 *
 *  ── ⚠️ E IL COLORE SI GUARDA COME UNA CIOCCA ─────────────────────────────
 *  Un pallino piatto del colore giusto non dice come verrà: i capelli hanno
 *  luce, ombra e ciocche, e un castano piatto sembra marrone di plastica.
 *  Il campione qui è una ciocca — sfumata, con i fili — e assomiglia molto di
 *  più a quello che si ottiene.
 */
import type { ReactElement } from "react";
import { TAGLI, type ChiaveFamiglia, type ChiaveTaglio } from "./tagli";

/** La testa: la stessa in tutti e otto i disegni, così l'occhio confronta solo
 *  i capelli. Cambiare anche la faccia farebbe sembrare otto persone diverse. */
function Testa() {
  return (
    <g>
      {/*  Collo e spalle: senza, la testa galleggia e il taglio non si capisce
          dove finisce. */}
      <path d="M42 96c0 10-6 13-14 17-8 4-14 9-14 17h72c0-8-6-13-14-17-8-4-14-7-14-17z" fill="currentColor" opacity=".22" />
      <ellipse cx="50" cy="58" rx="24" ry="29" fill="currentColor" opacity=".3" />
      {/*  Le orecchie servono al confronto: dicono se un taglio le copre. */}
      <ellipse cx="25" cy="60" rx="4" ry="7" fill="currentColor" opacity=".3" />
      <ellipse cx="75" cy="60" rx="4" ry="7" fill="currentColor" opacity=".3" />
    </g>
  );
}

/** I capelli, uno per FAMIGLIA e non uno per taglio. Sono forme piene: a questa
 *  misura un disegno dettagliato diventa una macchia, mentre la sagoma si
 *  riconosce — e fra «sfumato alto» e «sfumato basso» una sagoma non saprebbe
 *  comunque dire la differenza, mentre una fotografia sì.
 *  ⚠️ QUESTI DISEGNI SONO IL RIPIEGO, non il pezzo forte: si vedono solo finché
 *   la fotografia di quel taglio non è stata generata, o se non si carica.
 *   Meglio una sagoma della famiglia giusta che un riquadro rotto. */
const CAPELLI: Record<string, ReactElement> = {
  //  Rasato: un velo sottile che segue il cranio, con l'attaccatura appena
  //  arretrata alle tempie — che è quello che si vede davvero su una rasatura.
  rasato: (
    <path
      d="M26 54c0-16 11-27 24-27s24 11 24 27c0-9-5-14-10-16-6-2-10 1-14 1s-8-3-14-1c-5 2-10 7-10 16z"
      fill="currentColor"
    />
  ),
  //  Corto classico: lati corti, sopra un po' più pieno, riga a sinistra.
  corto_classico: (
    <path
      d="M25 56c0-18 11-30 25-30s25 12 25 30c0-11-4-17-9-19-4 8-24 10-31 5-4 3-10 6-10 14z"
      fill="currentColor"
    />
  ),
  //  Sfumato alto: sotto sparisce, sopra resta un blocco netto e alto. È il
  //  contrasto fra i due a rendere riconoscibile questo taglio.
  //  ⚠️ La massa piena si ferma a metà cranio e SOTTO restano due fili lungo il
  //   profilo: è la sfumatura. Prima erano due archi sopra la testa e si
  //   leggevano come un cappello appoggiato — il difetto si vede solo
  //   guardando il disegno, mai leggendo il codice.
  corto_sfumato: (
    <>
      <path d="M26 52C26 31 37 24 50 24s24 7 24 28c-5-7-13-10-24-10s-19 3-24 10z" fill="currentColor" />
      <path d="M26 52c0 8 1 14 3 19l3-1c-2-6-3-11-3-18z" fill="currentColor" opacity=".4" />
      <path d="M74 52c0 8-1 14-3 19l-3-1c2-6 3-11 3-18z" fill="currentColor" opacity=".4" />
    </>
  ),
  //  Medio pettinato: copre le tempie e scende sopra le orecchie, con la riga.
  medio_pettinato: (
    <path
      d="M23 62c0-22 12-36 27-36s27 14 27 36c0-6-1-11-3-15-8 5-20 6-28 2-3 4-8 5-12 4-2 3-3 6-3 9-3 0-5-1-8 0z"
      fill="currentColor"
    />
  ),
  //  Medio mosso: stesso ingombro del pettinato, ma il bordo è ondulato — ed è
  //  l'unica differenza che conta, quindi è l'unica che si disegna.
  medio_mosso: (
    <path
      d="M22 64c-1-23 12-38 28-38s29 15 28 38c-2-4-5-4-7-8-3 4-6 3-9 0-4 5-8 4-11 1-4 4-8 4-11 0-3 4-6 5-9 1-2 3-5 3-9 6z"
      fill="currentColor"
    />
  ),
  //  Lungo liscio: due bande che scendono lungo le guance fino alle spalle.
  lungo_liscio: (
    <>
      <path d="M24 60c0-20 12-34 26-34s26 14 26 34v40h-9V62c-4 4-10 6-17 6s-13-2-17-6v38h-9z" fill="currentColor" />
    </>
  ),
  //  Ricci: il bordo è fatto di archi. Non si disegnano i singoli ricci — a
  //  questa misura si impastano — ma il PROFILO tondo li racconta lo stesso.
  //  ⚠️ DUE TENTATIVI SBAGLIATI PRIMA DI QUESTO, e li si è visti solo
  //   guardando il disegno a schermo: un profilo tondo diventava un berretto
  //   di lana, e la ciambella a festoni una fascia per capelli. I ricci si
  //   leggono per due cose insieme — la massa DENSA sopra la fronte, e il
  //   bordo BITORZOLUTO che esce dal profilo del cranio, perché un riccio
  //   occupa più spazio della testa che lo porta.
  riccio: (
    <>
      <path
        d="M20 60c-3-12 0-22 7-29 6-7 14-11 23-11s17 4 23 11c7 7 10 17 7 29-4-8-8-14-14-18-5-3-10-4-16-4s-11 1-16 4c-6 4-10 10-14 18z"
        fill="currentColor"
      />
      {/*  I bozzi: cinque cerchi appoggiati sul bordo. A questa misura fanno
          il lavoro che i singoli ricci non riuscirebbero a fare — si
          impasterebbero in una macchia. */}
      <circle cx="28" cy="34" r="6" fill="currentColor" />
      <circle cx="39" cy="25" r="6.5" fill="currentColor" />
      <circle cx="50" cy="22" r="7" fill="currentColor" />
      <circle cx="61" cy="25" r="6.5" fill="currentColor" />
      <circle cx="72" cy="34" r="6" fill="currentColor" />
    </>
  ),
  //  Ciuffo: la massa scende sulla fronte da un lato. È il taglio che nasconde
  //  l'attaccatura, e nel disegno si deve vedere che la copre.
  ciuffo: (
    <path
      d="M25 56c0-19 12-31 26-31s26 12 25 31c-1-8-4-13-8-16-2 9-14 15-24 13-3 4-4 8-4 12-5-1-9-4-15-9z"
      fill="currentColor"
    />
  ),
};

/** Il disegno di un taglio. `colore` tinge i capelli: nel passo del colore la
 *  stessa figura mostra la tinta scelta, così le due scelte si vedono insieme
 *  invece che una alla volta. */
/** Il disegno di una famiglia, scelto a partire dal taglio. Un taglio che non
 *  ha una sagoma sua ricade su quella della sua famiglia; uno che non ha
 *  nemmeno la famiglia — non dovrebbe succedere — ricade sul corto classico,
 *  che è la forma più neutra che abbiamo. */
const PER_FAMIGLIA: Record<ChiaveFamiglia, string> = {
  sfumati: "corto_sfumato",
  classici: "corto_classico",
  mossi: "medio_mosso",
  ricci: "riccio",
  lunghi: "lungo_liscio",
};

export function DisegnoTaglio({
  taglio, colore = "currentColor", className = "",
}: {
  taglio: ChiaveTaglio | "";
  colore?: string;
  className?: string;
}) {
  const famiglia = TAGLI.find((t) => t.chiave === taglio)?.famiglia;
  const forma = CAPELLI[taglio] ?? CAPELLI[famiglia ? PER_FAMIGLIA[famiglia] : "corto_classico"];
  return (
    <svg viewBox="0 0 100 130" className={className} role="img" aria-hidden="true">
      <Testa />
      <g style={{ color: colore }}>{forma}</g>
    </svg>
  );
}

/** ── IL CAMPIONE DI COLORE ─────────────────────────────────────────────────
 *  Una ciocca, non un pallino: sfumatura dal chiaro allo scuro e qualche filo
 *  più chiaro sopra. È la differenza fra «marrone» e «capelli castani». */
export function CiocCa({ colore, className = "" }: { colore: string; className?: string }) {
  const id = `c${colore.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colore} stopOpacity="0.75" />
          <stop offset="55%" stopColor={colore} />
          <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill={`url(#${id})`} />
      {/*  I fili: tre archi chiari che seguono la curva. Sono quello che fa
          leggere il cerchio come capelli invece che come una pallina. */}
      <g stroke="#fff" strokeOpacity=".28" strokeWidth="1.2" fill="none" strokeLinecap="round">
        <path d="M8 27c4-10 11-16 21-19" />
        <path d="M12 32c4-10 11-17 21-20" />
        <path d="M6 20C9 12 15 6 23 3" />
      </g>
    </svg>
  );
}

/** ── L'AVATAR DEL TAGLIO SU MISURA ─────────────────────────────────────────
 *
 *  ⚠️ DEVE DIRSI DA SOLO CHE È UN'ALTRA COSA. In una griglia di trentacinque
 *   fotografie di teste vere, un riquadro «creane uno tu» disegnato come le
 *   altre non si nota: si legge come il trentaseiesimo taglio. Questo invece è
 *   un avatar — sfera con luce e meridiani, capelli come un solido colorato,
 *   e i tre cursori accanto — e si capisce prima di leggere la scritta che lì
 *   dentro si COSTRUISCE qualcosa invece di sceglierlo.
 */
export function AvatarSuMisura({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-hidden="true">
      <defs>
        <radialGradient id="hgsm-testa" cx="34%" cy="26%" r="80%">
          {/*  ⚠️ La testa resta NEUTRA: con la testa azzurra come i capelli i
              due volumi si fondevano in una macchia sola, e il taglio — che è
              il soggetto — spariva dentro la sfera. */}
          <stop offset="0%" stopColor="#f4f8ff" />
          <stop offset="44%" stopColor="#9aacc8" />
          <stop offset="100%" stopColor="#222a42" />
        </radialGradient>
        <linearGradient id="hgsm-capelli" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="50%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="hgsm-collo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5878c4" />
          <stop offset="100%" stopColor="#141d3a" />
        </linearGradient>
      </defs>

      {/*  L'ombra a terra: è quello che stacca la sfera dal fondo e la fa
          leggere come un volume invece che come un cerchio. */}
      <ellipse cx="52" cy="109" rx="27" ry="4.5" fill="#000" opacity=".38" />

      {/*  Collo e spalle */}
      <path d="M39 82c0 9-4 12-11 15-7 3-12 7-12 12h72c0-5-5-9-12-12-7-3-11-6-11-15z" fill="url(#hgsm-collo)" />

      {/*  La testa */}
      <ellipse cx="52" cy="52" rx="28" ry="32" fill="url(#hgsm-testa)" />
      {/*  I meridiani: due archi soli. Tre diventano una gabbia, uno non basta
          a dire che è una sfera. */}
      <g fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="1.1">
        <ellipse cx="52" cy="52" rx="11" ry="32" />
        <path d="M25 46c8 5 46 5 54 0" />
      </g>
      {/*  Il riflesso in alto a sinistra: la luce sta sempre da una parte sola,
          e questa è quella da cui la guarda il resto del programma. */}
      <ellipse cx="41" cy="36" rx="9" ry="6" fill="#fff" opacity=".3" transform="rotate(-24 41 36)" />

      {/*  I capelli, come un solido colorato: non sono UN taglio, sono la
          materia con cui se ne fa uno. */}
      <path
        d="M24 50c0-18 13-30 28-30s28 12 28 30c0-10-6-15-12-17-6-2-11 2-16 2s-10-4-16-2c-6 2-12 7-12 17z"
        fill="url(#hgsm-capelli)"
      />
      <path d="M24 50c1-9 6-15 12-17-3 5-4 11-4 17z" fill="#fff" opacity=".2" />
      {/*  L'ombra sotto l'attaccatura: è il filo che stacca i capelli dalla
          fronte. Senza, il colore dei capelli sfuma nella testa e i due
          volumi diventano uno. */}
      <path
        d="M24 50c0-10 6-15 12-17 6-2 11 2 16 2s10-4 16-2c6 2 12 7 12 17"
        fill="none"
        stroke="#0b1020"
        strokeOpacity=".45"
        strokeWidth="1.6"
      />

      {/*  I tre cursori: sono la parola «componi» detta senza scriverla. */}
      <g transform="translate(88 34)">
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(0 ${i * 15})`}>
            <rect x="0" y="4" width="26" height="3.4" rx="1.7" fill="#fff" opacity=".22" />
            <rect x="0" y="4" width={[18, 8, 23][i]} height="3.4" rx="1.7" fill="url(#hgsm-capelli)" />
            <circle cx={[18, 8, 23][i]} cy="5.7" r="4.2" fill="#e8f1ff" />
          </g>
        ))}
      </g>
      {/*  La scintilla: lo stesso segno che si usa dappertutto qui dentro. */}
      <path
        d="M100 88l2.4 5.9 5.9 2.4-5.9 2.4-2.4 5.9-2.4-5.9-5.9-2.4 5.9-2.4z"
        fill="#8fd6ff"
        opacity=".9"
      />
    </svg>
  );
}
