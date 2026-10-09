/** ── I LATERALI, SCELTI A PARTE ────────────────────────────────────────────
 *
 *  «Quello, ma sfumato più basso» è la seconda frase che si dice su una
 *  poltrona da barbiere, subito dopo il nome del taglio. Finora i laterali
 *  arrivavano SOLO dalle parole del taglio scelto: se la scheda diceva «high
 *  fade», la sfumatura alta arrivava comunque, e non c'era modo di chiedere
 *  altro.
 *
 *  ── ⚠️ UNA SOLA, NON A SPUNTA ────────────────────────────────────────────
 *  I laterali sono uno: «bassa» e «alta» insieme non esistono, e lasciarle
 *  spuntare tutte e due manderebbe al modello due ordini che si contraddicono
 *  — che è il modo più sicuro per ottenere una terza cosa a caso.
 *
 *  ── ⚠️ «FINO ALLA PELLE» È L'INTENSITÀ, NON IL PUNTO ─────────────────────
 *  Si combina con bassa, media e alta: metterla come tredicesima voce vorrebbe
 *  dire scrivere tre volte la stessa cosa. Su chi non ha sfumatura non ha
 *  senso e non si mostra.
 *
 *  ── ⚠️ E SI FILTRANO PER FAMIGLIA ────────────────────────────────────────
 *  La sfumatura alta su un taglio lungo è una richiesta impossibile: la
 *  persona la sceglie, il risultato non cambia, e da fuori sembra che il
 *  programma la ignori. Meglio sei voci vere che dodici di cui sei finte.
 */
export interface Laterale {
  chiave: string;
  /** come si legge a schermo */
  nome: string;
  /** la riga sotto: dice che cosa cambia davvero */
  nota: string;
  /** l'istruzione per il modello */
  inglese: string;
  /** è una sfumatura: solo qui ha senso «fino alla pelle» */
  sfumatura?: boolean;
  /** per quali famiglie ha senso; vuoto = per tutte */
  famiglie?: string[];
}

/** Il predefinito: i laterali che il taglio scelto porta con sé. ⚠️ Deve
 *  esistere come voce, e deve essere il primo: chi non tocca niente deve
 *  ottenere il taglio che ha scelto, non una sfumatura decisa da noi. */
export const LATERALI_COME_IL_TAGLIO = "come_il_taglio";

export const LATERALI: Laterale[] = [
  {
    chiave: LATERALI_COME_IL_TAGLIO,
    nome: "Come il taglio scelto",
    nota: "Lascio decidere al taglio",
    inglese: "",
  },

  //  ── CON LA SFUMATURA ────────────────────────────────────────────────────
  {
    chiave: "sfumatura_bassa",
    nome: "Sfumatura bassa",
    nota: "Parte appena sopra l'orecchio, il resto resta pieno",
    sfumatura: true,
    famiglie: ["sfumati", "classici", "mossi", "ricci"],
    inglese: "LOW taper fade: the sides and the back keep their length almost everywhere and the "
      + "hair only shortens in the last couple of centimetres, just above the ears, around the "
      + "sideburns and along the nape. The gradient must stay LOW — well below the temples — and "
      + "be soft and gradual.",
  },
  {
    chiave: "sfumatura_media",
    nome: "Sfumatura media",
    nota: "Parte a metà tempia",
    sfumatura: true,
    famiglie: ["sfumati", "classici", "mossi", "ricci"],
    inglese: "MID fade: the gradient starts around the middle of the temples, roughly halfway up "
      + "the side of the head, and blends smoothly from short at the ear up into the longer top.",
  },
  {
    chiave: "sfumatura_alta",
    nome: "Sfumatura alta",
    nota: "Parte in alto sulla tempia, stacco forte",
    sfumatura: true,
    famiglie: ["sfumati", "classici", "mossi", "ricci"],
    inglese: "HIGH fade: the gradient starts high, at the corner of the temples and along the "
      + "parietal ridge, leaving the sides very short with a strong contrast against the top.",
  },
  {
    chiave: "sfumatura_goccia",
    nome: "Sfumatura a goccia",
    nota: "La linea scende in curva dietro l'orecchio",
    sfumatura: true,
    famiglie: ["sfumati", "mossi", "ricci"],
    inglese: "DROP fade: the fade line does not run straight around the head — it curves downwards "
      + "behind the ear, following the shape of the skull, and lands lower at the nape.",
  },
  {
    chiave: "sfumatura_ventaglio",
    nome: "Sfumatura a ventaglio",
    nota: "Sfuma solo attorno all'orecchio, la nuca resta lunga",
    sfumatura: true,
    famiglie: ["sfumati", "mossi", "ricci", "lunghi"],
    inglese: "BURST fade: the fade is a semicircle AROUND THE EAR ONLY, radiating outwards from "
      + "it. The hair at the nape and behind the head is NOT faded and stays clearly longer.",
  },

  //  ── SENZA SFUMATURA ─────────────────────────────────────────────────────
  {
    chiave: "corti_uniformi",
    nome: "Corti uniformi",
    nota: "Una misura sola, niente gradazione",
    famiglie: ["sfumati", "classici", "mossi", "ricci"],
    inglese: "The sides and the back are clipped to ONE uniform short length all over, with no "
      + "gradient and no fade: same length at the nape, behind the ears and at the temples.",
  },
  {
    chiave: "undercut",
    nome: "Undercut staccato",
    nota: "Lati corti con uno stacco netto, senza sfumare",
    famiglie: ["sfumati", "classici", "mossi", "ricci"],
    inglese: "DISCONNECTED UNDERCUT: the sides and the back are one short length and the top is "
      + "clearly longer, with a visible disconnection between the two. Do NOT blend or fade them "
      + "into each other.",
  },
  {
    chiave: "forbice",
    nome: "Sfilati a forbice",
    nota: "Niente macchinetta: si accorciano naturali, senza linee",
    inglese: "SCISSOR-CUT sides: no clippers, no fade, no visible line anywhere. The sides are "
      + "shortened naturally with scissors, keeping some weight and texture, and blend softly into "
      + "the top so the whole cut looks grown-in and natural rather than machine-cut.",
  },
  {
    chiave: "medi_orecchie",
    nome: "Medi sulle orecchie",
    nota: "Cresciuti, appoggiano sulla parte alta dell'orecchio",
    famiglie: ["classici", "mossi", "ricci", "lunghi"],
    inglese: "The sides are left MEDIUM and grown out, long enough to cover the top half of the "
      + "ears and sit over them. Nothing is shaved, faded or clipped short.",
  },
  {
    chiave: "lunghi_dietro",
    nome: "Lunghi dietro le orecchie",
    nota: "Abbastanza lunghi da stare dietro l'orecchio",
    famiglie: ["classici", "mossi", "ricci", "lunghi"],
    inglese: "The sides are LONG — past the ears, long enough to be tucked behind them — and they "
      + "are swept back rather than cut short. No fade, no clipper work at all.",
  },
  {
    chiave: "nuca_lunga",
    nome: "Nuca lunga",
    nota: "Lati contenuti e nuca che scende",
    famiglie: ["sfumati", "mossi", "ricci", "lunghi"],
    inglese: "A modern MULLET shape: the sides are kept short to medium, while the hair at the "
      + "NAPE is deliberately left much longer and falls down over the neck.",
  },
];

export const trovaLaterale = (chiave: string): Laterale | undefined =>
  LATERALI.find((l) => l.chiave === chiave);

/** I laterali che hanno senso per questa famiglia di tagli.
 *  ⚠️ Senza famiglia — una foto caricata, un taglio composto — si mostrano i
 *   larghi: nel dubbio si offre il meno specifico, mai il più rischioso. */
export function lateraliPer(famiglia?: string): Laterale[] {
  const f = String(famiglia || "").trim();
  if (f) return LATERALI.filter((l) => !l.famiglie || l.famiglie.includes(f));
  return LATERALI.filter((l) => !l.famiglie || l.famiglie.length >= 3);
}

/** ── L'ISTRUZIONE PER IL MODELLO ───────────────────────────────────────────
 *  Vuota quando i laterali li decide il taglio: è il solo caso in cui questa
 *  scelta non deve dire niente, e una riga vuota qui vale più di una riga che
 *  ripete quello che c'è già scritto sopra.
 *
 *  ⚠️ La riga si apre dicendo che SCAVALCA il taglio. Senza, il modello ha
 *   davanti due frasi — «questo taglio è sfumato alto» e «sfumatura bassa» —
 *   e sceglie quella che ha letto per prima, che è sempre quella del taglio.
 */
export function rigaLaterali(chiave: string, pelle = false): string {
  const l = trovaLaterale(String(chiave || ""));
  if (!l || !l.inglese) return "";
  const pelleVera = pelle && !!l.sfumatura;
  return [
    "THE SIDES ARE CHOSEN EXPLICITLY, and this choice OVERRIDES whatever the haircut description "
      + "above says about the sides and the back:",
    l.inglese,
    ...(pelleVera
      ? ["Take that fade all the way DOWN TO BARE SKIN at its shortest point, so the skin shows "
        + "through at the bottom before the hair starts."]
      : l.sfumatura
        ? ["Do not shave down to bare skin: the shortest point still keeps a shadow of hair."]
        : []),
  ].join(" ");
}
