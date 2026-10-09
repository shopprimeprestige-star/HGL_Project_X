/** ── IL TAGLIO SU MISURA ───────────────────────────────────────────────────
 *
 *  Il catalogo è fatto di tagli interi: si sceglie quello più vicino e si spera.
 *  Ma chi arriva qui ha in testa dei PEZZI — «medio, mosso, ciuffo in avanti,
 *  sfumatura bassa» — e nessuna fotografia del catalogo li ha mai tutti e
 *  quattro insieme. Qui il taglio si compone: si sceglie una voce per gruppo e
 *  la descrizione per il modello si scrive da sola.
 *
 *  ── ⚠️ UNA VOCE PER GRUPPO, NON UNA LISTA DELLA SPESA ────────────────────
 *  Ogni gruppo risponde a una domanda sola e ammette una risposta sola: quanto
 *  lungo sopra, che capello, che ciuffo, dove va. Due risposte allo stesso
 *  gruppo sono due ordini che si contraddicono, e il modello ne inventa un
 *  terzo.
 *
 *  ── ⚠️ E OGNI VOCE PORTA LA SUA MISURA ───────────────────────────────────
 *  «Medio» per un modello non vuol dire niente: il catalogo funziona perché
 *  ogni scheda dice «approximately 10cm». Le voci qui sotto fanno lo stesso —
 *  senza centimetri, «corto» e «medio» tornano identici.
 */

export interface VoceComposta {
  chiave: string;
  nome: string;
  /** la riga sotto, per chi sceglie */
  nota?: string;
  /** il pezzo di descrizione per il modello */
  inglese: string;
}

export interface GruppoComposto {
  chiave: string;
  /** la domanda a cui risponde */
  nome: string;
  voci: VoceComposta[];
}

export const GRUPPI: GruppoComposto[] = [
  {
    chiave: "lunghezza",
    nome: "Quanto lungo sopra",
    voci: [
      { chiave: "corto", nome: "Corto", nota: "3-4 cm, si pettina appena", inglese: "kept SHORT on top, approximately 3-4cm" },
      { chiave: "medio", nome: "Medio", nota: "7-8 cm, si può pettinare", inglese: "MEDIUM on top, approximately 7-8cm" },
      { chiave: "lungo", nome: "Lungo", nota: "12-15 cm, cade", inglese: "LONG on top, approximately 12-15cm, long enough to fall under its own weight" },
      { chiave: "molto_lungo", nome: "Molto lungo", nota: "Fino alle spalle", inglese: "VERY LONG, reaching the shoulders" },
    ],
  },
  {
    chiave: "texture",
    nome: "Che capello",
    voci: [
      { chiave: "liscio", nome: "Liscio", nota: "Senza onda", inglese: "with a STRAIGHT texture and a natural healthy shine" },
      { chiave: "mosso", nome: "Mosso", nota: "Onda morbida", inglese: "with a soft, natural WAVY texture running through it" },
      { chiave: "riccio", nome: "Riccio", nota: "Ricci definiti", inglese: "with CURLY texture: defined, separated, springy curls" },
      { chiave: "riccio_stretto", nome: "Riccio stretto", nota: "Ricci fitti, molto arricciati", inglese: "with TIGHTLY CURLY texture: dense, compact coils" },
    ],
  },
  {
    chiave: "ciuffo",
    nome: "Il ciuffo davanti",
    voci: [
      { chiave: "senza", nome: "Senza ciuffo", nota: "Fronte scoperta", inglese: "and NO fringe at all: the front is kept up and off the forehead" },
      { chiave: "corto", nome: "Ciuffo corto", nota: "Appena sulla fronte", inglese: "finished with a SHORT fringe that just touches the forehead" },
      { chiave: "medio", nome: "Ciuffo medio", nota: "A metà fronte", inglese: "finished with a MEDIUM fringe falling to the middle of the forehead" },
      { chiave: "lungo", nome: "Ciuffo lungo", nota: "Fino alle sopracciglia", inglese: "finished with a LONG fringe reaching down to the eyebrows" },
    ],
  },
  {
    chiave: "direzione",
    nome: "Dove vanno i capelli",
    voci: [
      { chiave: "avanti", nome: "In avanti", nota: "Portati sulla fronte", inglese: "styled FORWARD over the forehead with a textured finish" },
      { chiave: "indietro", nome: "All'indietro", nota: "Pettinati indietro", inglese: "swept BACKWARD away from the face, with volume at the root" },
      { chiave: "lato", nome: "Di lato", nota: "Con la riga di lato", inglese: "styled TO ONE SIDE, with a soft natural side parting" },
      { chiave: "alzato", nome: "Alzato", nota: "Volume in cima", inglese: "lifted UPWARDS at the front for height and volume" },
      { chiave: "naturale", nome: "Naturale", nota: "Come cade", inglese: "left to fall NATURALLY, with no forced styling direction" },
    ],
  },
];

export interface Composto {
  lunghezza?: string;
  texture?: string;
  ciuffo?: string;
  direzione?: string;
  /** i laterali, dalla tabella dei laterali */
  laterali?: string;
  /** la sfumatura arriva fino alla pelle */
  pelle?: boolean;
}

export const trovaVoce = (gruppo: string, chiave: string): VoceComposta | undefined =>
  GRUPPI.find((g) => g.chiave === gruppo)?.voci.find((v) => v.chiave === chiave);

const scelta = (c: Composto, gruppo: string): string =>
  String((c as Record<string, unknown>)[gruppo] ?? "");

/** ── QUANDO SI PUÒ GENERARE ────────────────────────────────────────────────
 *  ⚠️ Lunghezza e capello sono obbligatori, il resto no. Senza quei due non
 *   c'è un taglio: c'è un elenco di dettagli attorno al niente, e il modello
 *   riempie il buco con quello che la persona ha già in testa — che è
 *   esattamente il difetto per cui questa pagina esiste.
 */
export function compostoPieno(c: Composto | null | undefined): boolean {
  if (!c) return false;
  return !!trovaVoce("lunghezza", scelta(c, "lunghezza"))
    && !!trovaVoce("texture", scelta(c, "texture"));
}

/** La descrizione per il modello. Vuota se manca l'essenziale: meglio niente
 *  che mezzo taglio, che la porta rifiuta prima di spendere una generazione. */
export function descrizioneComposta(c: Composto | null | undefined): string {
  if (!compostoPieno(c)) return "";
  const pezzi = GRUPPI
    .map((g) => trovaVoce(g.chiave, scelta(c as Composto, g.chiave))?.inglese)
    .filter((s): s is string => !!s);
  /** ── ⚠️ UNA FRASE, NON UN ELENCO DI VINCOLI ────────────────────────────
   *  DIFETTO VISTO CON GLI OCCHI: i tagli composti uscivano brutti. Le schede
   *  del catalogo sono descrizioni di fotografie vere — scritte come parla un
   *  barbiere — mentre qui partiva un elenco di misure separate dai punti e
   *  virgola, e a un elenco il modello risponde con un elenco: un casco di
   *  capelli della lunghezza giusta, senza mestiere dentro.
   *  ⚠️ E la riga sulla qualità non è decorazione: è l'unica parte che dice
   *   che deve sembrare un taglio VERO e appena fatto. Le schede del catalogo
   *   non ne hanno bisogno perché nascono da una fotografia; questa sì, perché
   *   nasce da quattro caselle. */
  return `a custom men's haircut, cut and finished by a professional barber — ${pezzi.join(", ")}. `
    + "The outline is clean, the hairline natural and slightly irregular, the density believable: "
    + "it must look like a REAL haircut on a real head, freshly cut and well groomed — never a wig, "
    + "never a helmet or a bowl of hair sitting on the head, never a flat shapeless cap. "
    /** ⚠️ LA PROPORZIONE È LA COSA CHE TRADISCE LA PARRUCCA, più della forma:
     *  il modello, sentendosi chiedere una lunghezza, aggiunge MASSA — e la
     *  testa diventa più grande e più alta di quella della persona. Detto come
     *  vincolo sulla sagoma smette di succedere. */
    + "The hair follows the skull and adds volume WITHOUT making the head bigger or taller: seen "
    + "from the front its outline is only slightly wider than the skull, the sides hug the head, "
    + "and the amount of hair is the amount a barber would actually leave — not a thick even mass";
}

/** Come si chiama davanti alla persona — «Medio mosso, ciuffo corto, in
 *  avanti». ⚠️ Serve nella filigrana, nella scheda del cliente e nel messaggio
 *  su WhatsApp: senza, un taglio composto si chiamerebbe «Su misura» in tutti
 *  e tre i posti, e due prove diverse sarebbero indistinguibili. */
export function nomeComposto(c: Composto | null | undefined): string {
  if (!compostoPieno(c)) return "Taglio su misura";
  const nome = (g: string): string => trovaVoce(g, scelta(c as Composto, g))?.nome || "";
  const testa = [nome("lunghezza"), nome("texture").toLowerCase()].filter(Boolean).join(" ");
  const coda = [
    scelta(c as Composto, "ciuffo") && scelta(c as Composto, "ciuffo") !== "senza"
      ? nome("ciuffo").toLowerCase()
      : "",
    nome("direzione").toLowerCase(),
  ].filter(Boolean);
  return coda.length ? `${testa}, ${coda.join(", ")}` : testa;
}

/** ── ⚠️ I LATERALI, QUANDO NESSUNO LI HA SCELTI ────────────────────────────
 *  È QUI CHE NASCEVA IL CASCO. Un taglio composto non nomina nessuna
 *  sfumatura, e la regola generale, non trovandone, vietava al modello di
 *  accorciare i lati: risultato, un sopra corto con i lati della stessa
 *  lunghezza — che non è un taglio, è una parrucca. Il predefinito dipende da
 *  quanto è lungo sopra, che è l'unica cosa che lo decide davvero: sotto, lati
 *  più corti raccordati; sopra, lati lunghi come il resto.
 */
export function lateraliPredefiniti(c: Composto | null | undefined): string {
  const lunga = scelta(c || {}, "lunghezza");
  if (lunga === "lungo" || lunga === "molto_lungo") {
    return "THE SIDES AND THE BACK: left LONG to match the top, falling naturally over and around "
      + "the ears and blending into the length at the back. No fade, no clipper work, no shaved "
      + "skin, no short sides under a long top.";
  }
  return "THE SIDES AND THE BACK: cut clearly SHORTER than the top and blended into it smoothly "
    + "and gradually, following the shape of the head — a clean natural barber taper, shortest "
    + "around the ears and at the nape. No hard line, no shaved skin, no disconnection. The sides "
    + "must NEVER be the same length as the top, and the hair must never sit on the head as one "
    + "round bowl.";
}

/** La famiglia più vicina a un taglio composto: serve per offrire i laterali
 *  che hanno senso. ⚠️ La decide la lunghezza sopra, non la texture: la
 *  sfumatura alta sotto una chioma lunga è impossibile qualunque riccio abbia. */
export function famigliaDelComposto(c: Composto | null | undefined): string {
  const lunga = scelta(c || {}, "lunghezza");
  if (lunga === "molto_lungo") return "lunghi";
  if (lunga === "lungo") return "mossi";
  return "sfumati";
}

/** ── LE VOCI CHE HANNO SENSO CON QUELLO CHE SI È GIÀ SCELTO ────────────────
 *  ⚠️ Un ciuffo non può essere più lungo dei capelli: «corto sopra, ciuffo
 *   fino alle sopracciglia» è una richiesta impossibile, e offrirla vuol dire
 *   generare un taglio che con le caselle toccate non c'entra niente. Stessa
 *   cosa per il ciuffo alzato su una chioma che arriva alle spalle.
 */
export function vociPer(gruppo: string, c: Composto | null | undefined): VoceComposta[] {
  const g = GRUPPI.find((x) => x.chiave === gruppo);
  if (!g) return [];
  const lunga = scelta(c || {}, "lunghezza");
  if (gruppo === "ciuffo") {
    if (lunga === "corto") return g.voci.filter((v) => v.chiave === "senza" || v.chiave === "corto");
    if (lunga === "medio") return g.voci.filter((v) => v.chiave !== "lungo");
  }
  if (gruppo === "direzione" && (lunga === "lungo" || lunga === "molto_lungo")) {
    return g.voci.filter((v) => v.chiave !== "alzato");
  }
  return g.voci;
}

/** Toglie le scelte diventate impossibili dopo aver cambiato la lunghezza.
 *  ⚠️ Senza, una scelta fatta prima resta spuntata ma non si vede più fra le
 *   voci offerte: la persona non capisce perché il risultato non la rispetta. */
export function ripulisci(c: Composto): Composto {
  const pulito: Composto = { ...c };
  for (const g of ["ciuffo", "direzione"]) {
    const v = scelta(pulito, g);
    if (v && !vociPer(g, pulito).some((x) => x.chiave === v)) {
      delete (pulito as Record<string, unknown>)[g];
    }
  }
  return pulito;
}
