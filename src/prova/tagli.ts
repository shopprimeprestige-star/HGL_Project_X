/** ── I TAGLI CHE SI POSSONO PROVARE, E COME SI CHIEDONO AL MODELLO ─────────
 *
 *  Questo file non parla con nessuno: prende un taglio, un colore e due cose
 *  sulla persona, e restituisce il TESTO con cui si chiede l'immagine. È tenuto
 *  puro apposta — nessuna rete, nessun React — perché è la parte che si può
 *  provare per intero, ed è anche quella che sbaglia in modo invisibile: un
 *  prompt storto non fallisce, RESTITUISCE UNA FACCIA DIVERSA.
 *
 *  ── ⚠️ IL DIFETTO CHE QUESTE RIGHE ESISTONO PER NON FARE ──────────────────
 *  Un modello che «rifà» una foto la migliora sempre: assottiglia il naso,
 *  sbianca i denti, ringiovanisce la pelle, raddrizza gli occhi. Su una prova
 *  di capelli è il fallimento totale — la persona guarda e non si riconosce, e
 *  quello che pensa non è «bel taglio», è «questo non sono io, quindi non è
 *  vero niente». Metà delle istruzioni qui sotto non chiedono di aggiungere
 *  capelli: chiedono di NON TOCCARE tutto il resto.
 *
 *  ── ⚠️ E IL COLORE, SE NON LO SCEGLIE LUI, LO DICE LA BARBA ───────────────
 *  È la richiesta del committente, ed è anche la cosa giusta: chi è calvo da
 *  dieci anni non sa più di che colore ha i capelli, ma ce l'ha scritto in
 *  faccia — barba, baffi, sopracciglia, e i capelli rimasti ai lati. Un
 *  castano acceso su una barba bianca si vede al primo sguardo ed è la cosa che
 *  fa dire «finto». Quando il colore non lo sceglie la persona, NON si inventa:
 *  si copia da lì, brizzolatura compresa.
 *
 *  ── PERCHÉ IL TESTO È IN INGLESE ─────────────────────────────────────────
 *  Questi modelli seguono l'inglese in modo molto più letterale. Non è una
 *  preferenza di stile: in italiano «non cambiare il viso» viene interpretato
 *  come un consiglio, in inglese come un vincolo. Quello che legge la persona è
 *  in italiano (`nome` e `descrizione`); quello che legge il modello è qui.
 */

export type ChiaveFamiglia =
  //  ⚠️ «Corti» non c'è più, e non è una dimenticanza: fra le fotografie
  //   scelte non c'era nessun rasato, e una famiglia senza tagli è un titolo
  //   che intesta il nulla. Torna il giorno in cui torna una foto di un
  //   rasato, non un minuto prima.
  | "sfumati"
  | "classici"
  | "mossi"
  | "ricci"
  | "lunghi";

/** ── ⚠️ VENTIQUATTRO TAGLI VOGLIONO UN ORDINE ─────────────────────────────
 *  Otto stavano in due schermate e si scorrevano. Ventiquattro no: senza
 *  famiglie diventano un muro di riquadri tutti uguali, e chi cerca «qualcosa
 *  di mosso» li guarda tutti e ventiquattro uno per uno.
 *  Le famiglie sono il modo in cui la gente li chiede davvero — «corto»,
 *  «sfumato», «mosso», «riccio», «lungo» — non un ordine da parrucchiere. */
export interface Famiglia {
  chiave: ChiaveFamiglia;
  nome: string;
  /** Una riga che dice a chi sta bene questa famiglia. */
  nota: string;
}

export const FAMIGLIE: Famiglia[] = [
  { chiave: "sfumati", nome: "Sfumati", nota: "Lati che sfumano, volume sopra. Moderni e puliti." },
  { chiave: "classici", nome: "Classici", nota: "Con la riga, ordinati. Vanno bene quasi a tutti." },
  { chiave: "mossi", nome: "Mossi", nota: "Onde e movimento. Morbidi, meno formali." },
  { chiave: "ricci", nome: "Ricci", nota: "Riccio definito, con volume." },
  { chiave: "lunghi", nome: "Lunghi", nota: "Dalle orecchie in giù, per vedersi con i capelli lunghi." },
];

/** ⚠️ Le chiavi le scrive il generatore a partire dal nome del taglio, e sono
 *  anche il nome del file della fotografia in `public/tagli/`. Cambiarne una a
 *  mano qui, senza rinominare il file, vuol dire un riquadro senza foto. */
/** ⚠️ Le chiavi le scrive il generatore a partire dal nome del taglio, e sono
 *  anche il nome del file della fotografia in `public/tagli/`. Cambiarne una a
 *  mano qui, senza rinominare il file, vuol dire un riquadro senza foto. */
/** ⚠️ Le chiavi le scrive il generatore a partire dal nome del taglio, e sono
 *  anche il nome del file della fotografia in `public/tagli/`. Cambiarne una a
 *  mano qui, senza rinominare il file, vuol dire un riquadro senza foto. */
/** ⚠️ Le chiavi le scrive il generatore a partire dal nome del taglio, e sono
 *  anche il nome del file della fotografia in `public/tagli/`. Cambiarne una a
 *  mano qui, senza rinominare il file, vuol dire un riquadro senza foto. */
export type ChiaveTaglio =
  | "sfumato_mosso_voluminoso"
  | "sfumato_all_indietro"
  | "sfumato_laterale_lungo"
  | "sfumato_laterale_mosso"
  | "sfumato_textured_crop"
  | "sfumato_mosso"
  | "sfumatura_alta_strutturata"
  | "ricci_naturali_scalati"
  | "wavy_lunghezza_media"
  | "sfumato_riccio_corto"
  | "classico_pettinato_indietro"
  | "capelli_mossi_lunghi"
  | "capelli_lunghi_pettinati_all"
  | "capelli_mossi_naturali"
  | "riccio_naturale"
  | "sfumato_riccio_indietro"
  | "corto_mosso"
  | "wavy_con_frangia"
  | "ricci_naturali"
  | "capelli_mossi_lunghi_2"
  | "riccio_sfumato_pelle"
  | "mosso_sfumato_medio"
  | "ciuffo_mosso_sfumato"
  | "riccio_alto_sfumato"
  | "mosso_indietro_rasato"
  | "ricci_morbidi"
  | "sfumato_con_frangia"
  | "lungo_mosso_di_lato"
  | "ricci_sfumatura_netta"
  | "mosso_alzato"
  | "mosso_indietro"
  | "mosso_in_avanti"
  | "mosso_con_volume"
  | "indietro_con_onda";

export interface Taglio {
  chiave: ChiaveTaglio;
  famiglia: ChiaveFamiglia;
  /** Come si chiama davanti alla persona. */
  nome: string;
  /** Una riga che dice a chi sta bene: è quello che fa scegliere. */
  descrizione: string;
  /** La descrizione tecnica per il modello, in inglese. */
  inglese: string;
}

/** ⚠️ OGNI RIGA INGLESE DESCRIVE SOLO I CAPELLI. Nessuna parla di faccia, di
 *  età o di posa: quelle le porta la fotografia di partenza, e nominarle qui
 *  vorrebbe dire dare al modello il permesso di cambiarle. */
/** ── ⚠️ IL CATALOGO NASCE DALLE FOTOGRAFIE, NON DALLE MIE PAROLE ──────────
 *  Ogni riga qui sotto viene da una foto scelta dal committente, letta da un
 *  modello e ridotta a scheda (`prove/leggi-tagli.mjs`). Le ventotto foto
 *  erano venti tagli veri: i doppioni li ha tolti il confronto fra i CAMPI —
 *  lati, texture, direzione, lunghezza — non l'occhio, che su ventotto foto si
 *  stanca a metà e tiene due gemelli.
 *  ⚠️ `inglese` è la descrizione LETTA DALLA FOTO, non una che ho scritto io:
 *   è la stessa che ha generato l'esempio in `public/tagli/`, quindi le parole
 *   della pagina e la fotografia raccontano lo stesso taglio per costruzione.
 *   Riscriverla a mano senza rigenerare l'immagine le farebbe divergere, ed è
 *   il modo in cui un catalogo comincia a mentire.
 *  ⚠️ Nessuna riga nomina la faccia, l'età o il colore: quelle le porta la
 *   fotografia della persona, e nominarle qui darebbe al modello il permesso
 *   di cambiarle.
 *  Si rifà con: node prove/leggi-tagli.mjs && node prove/genera-da-foto.mjs
 */
export const TAGLI: Taglio[] = [
  {
    chiave: "sfumato_mosso_voluminoso",
    famiglia: "mossi",
    nome: "Mosso voluminoso",
    descrizione: "Lati sfoltiti, sopra mosso alzato.",
    inglese:
      "The sides and back feature a medium taper that blends smoothly into the slightly longer top, creating a voluminous wavy texture styled upwards and slightly forward for an undone look. No defined parting or fringe is present.",
  },
  {
    chiave: "sfumato_all_indietro",
    famiglia: "classici",
    nome: "Sfumato all'indietro",
    descrizione: "Lati sfoltiti, sopra mosso portato indietro.",
    inglese:
      "The sides and back feature a clean tapered cut, gradually fading from short at the nape and ears to longer on top. The top hair, approximately 7cm long and wavy, is styled backward with significant volume and no defined parting or fringe, creating a sleek, mature look.",
  },
  {
    chiave: "sfumato_laterale_lungo",
    famiglia: "classici",
    nome: "Laterale lungo",
    descrizione: "Lati corti a forbice, sopra mosso portato di lato, con la frangia.",
    inglese:
      "The sides and back are scissor-cut short to a medium length, maintaining some weight. The top hair is approximately 10cm long with natural wavy texture, styled to the side with significant volume and a soft side part. The front forms a long, swept fringe.",
  },
  {
    chiave: "sfumato_laterale_mosso",
    famiglia: "sfumati",
    nome: "Sfumato mosso laterale",
    descrizione: "Lati sfumati, sopra mosso portato indietro.",
    inglese:
      "High fade on the sides and back, blending into approximately 10cm of wavy hair on top, styled back with significant volume; no defined parting or fringe. ",
  },
  {
    chiave: "sfumato_textured_crop",
    famiglia: "sfumati",
    nome: "Sfumato spettinato",
    descrizione: "Lati sfumati, sopra mosso portato in avanti, con la frangia.",
    inglese:
      "This haircut features a high skin fade on the sides and back, blending sharply into the longer top. The top hair is approximately 6cm long, styled forward with a natural, wavy texture creating a textured crop, and finished with a short, choppy fringe. No distinct parting is present.",
  },
  {
    chiave: "sfumato_mosso",
    famiglia: "sfumati",
    nome: "Sfumato con ciuffo",
    descrizione: "Lati sfumati, sopra mosso portato in avanti, con la frangia.",
    inglese:
      "This is a high fade on the sides and back, blending into a medium-length, wavy top around 10cm, styled forward with a textured, messy finish. It features a short, choppy fringe and no defined parting.",
  },
  {
    chiave: "sfumatura_alta_strutturata",
    famiglia: "sfumati",
    nome: "Sfumato alto",
    descrizione: "Lati sfumati, sopra liscio alzato.",
    inglese:
      "High skin fade on the sides and back, with the top hair kept at a medium length, styled upwards and slightly back for volume, maintaining a straight texture. No specific parting or fringe is present, emphasizing a clean transition from short sides to the longer top.",
  },
  {
    chiave: "ricci_naturali_scalati",
    famiglia: "ricci",
    nome: "Ricci scalati",
    descrizione: "Lati sfoltiti, sopra riccio portato in avanti, con la frangia.",
    inglese:
      "The sides and back are tapered to blend with the natural curly texture, maintaining a fuller look around the ears and nape. The top is left medium-long at approximately 7cm, allowing the natural curls to fall forward as a short fringe, giving it a natural, voluminous appearance without any defined parting.",
  },
  {
    chiave: "wavy_lunghezza_media",
    famiglia: "mossi",
    nome: "Medio mosso",
    descrizione: "Lati corti a forbice, sopra mosso alzato, con la frangia.",
    inglese:
      "The sides and back are scissor-cut short, gradually blending into the top. The top hair is medium length, with significant volume and texture, styled upwards and slightly forward, creating a messy, natural look with no defined parting and a long, tousled fringe.",
  },
  {
    chiave: "sfumato_riccio_corto",
    famiglia: "ricci",
    nome: "Riccio corto sfumato",
    descrizione: "Lati sfumati, sopra riccio portato in avanti, con la frangia.",
    inglese:
      "This is a mid-fade on the sides and back, with the top hair being short at approximately 3.5 cm in length, maintaining its natural curly texture styled forward as a short fringe without any parting.",
  },
  {
    chiave: "classico_pettinato_indietro",
    famiglia: "classici",
    nome: "Pettinato indietro",
    descrizione: "Lati corti a forbice, sopra mosso portato indietro.",
    inglese:
      "The sides and back are scissor-cut short to a uniform length, transitioning into a medium top length of approximately 6cm, with wavy texture styled back for a sleek, voluminous look without a defined parting or fringe.",
  },
  {
    chiave: "capelli_mossi_lunghi",
    famiglia: "lunghi",
    nome: "Lungo mosso",
    descrizione: "Lati lunghi, sopra mosso portato di lato, con la frangia.",
    inglese:
      "The sides and back are left long, matching the top length which is around 15cm. The hair has a natural wavy texture, styled to fall to the sides and slightly back with no specific parting, creating a long fringe that blends with the rest of the hair.",
  },
  {
    chiave: "capelli_lunghi_pettinati_all",
    famiglia: "lunghi",
    nome: "Lungo all'indietro",
    descrizione: "Lati lunghi, sopra liscio portato indietro.",
    inglese:
      "The sides and back are kept long, blended to the top. The top hair is long, approximately 15cm, with straight texture, styled neatly backward with a soft side part, and no fringe.",
  },
  {
    chiave: "capelli_mossi_naturali",
    famiglia: "lunghi",
    nome: "Lungo naturale",
    descrizione: "Lati lunghi, sopra mosso portato in avanti, con la frangia.",
    inglese:
      "The sides and back are kept long, styled down and slightly tucked behind the ears. The top hair is long, wavy, and has significant volume, styled forward to create a long fringe that gently covers the forehead, with no distinct parting.",
  },
  {
    chiave: "riccio_naturale",
    famiglia: "ricci",
    nome: "Riccio naturale",
    descrizione: "Lati corti a forbice, sopra riccio che cade, con la frangia.",
    inglese:
      "The sides and back are scissor-cut short, maintaining natural curly volume without a fade. The top hair is medium length, approximately 6cm, with natural curly texture styled down. There is no defined parting, and a long fringe blends into the overall style.",
  },
  {
    chiave: "sfumato_riccio_indietro",
    famiglia: "ricci",
    nome: "Riccio all'indietro",
    descrizione: "Lati sfoltiti, sopra riccio portato indietro.",
    inglese:
      "This cut features tapered sides and back, leaving the natural curls longer around the nape. The top hair is approximately 10cm long, showcasing voluminous, shiny curls styled backward, with no distinct parting or fringe.",
  },
  {
    chiave: "corto_mosso",
    famiglia: "mossi",
    nome: "Corto mosso",
    descrizione: "Lati sfoltiti, sopra mosso portato in avanti, con la frangia.",
    inglese:
      "The sides and back feature a clean tapered cut, maintaining some length that blends smoothly into the top. The top hair is around 6 cm long with a natural wavy texture, styled forward and slightly tousled to create a casual, textured look with a short fringe that subtly touches the forehead.",
  },
  {
    chiave: "wavy_con_frangia",
    famiglia: "mossi",
    nome: "Mosso con frangia",
    descrizione: "Lati corti a forbice, sopra mosso portato in avanti, con la frangia.",
    inglese:
      "The sides and back are scissor-cut short, leaving length around the ears and nape. The top hair is medium-length, wavy, and styled forward and down with a natural volume, framing the face with a long fringe, and no visible parting.",
  },
  {
    chiave: "ricci_naturali",
    famiglia: "mossi",
    nome: "Mosso naturale",
    descrizione: "Lati lunghi, sopra mosso portato in avanti.",
    inglese:
      "The sides and back are left long, seamlessly blending into the top. The top hair is medium length, approximately 10cm, styled forward with natural volume. The hair has a natural wavy texture, with no specific parting or fringe.",
  },
  {
    chiave: "capelli_mossi_lunghi_2",
    famiglia: "lunghi",
    nome: "Lungo con volume",
    descrizione: "Lati lunghi, sopra mosso alzato, con la frangia.",
    inglese:
      "The sides and back are kept long, styled back and slightly tucked behind the ears. The top hair is long, approximately 15cm, with significant volume due to its wavy texture, styled upwards and backwards. There is no defined part, and the long fringe blends into the overall length, creating a soft, natural flow.",
  },
  // ── ⚠️ I CINQUE CHE NON VENGONO DA UNA FOTO ────────────────────────────
  //  Tutti gli altri sono la copia di un taglio fotografato. Questi no: sono
  //  la stessa capigliatura di quelle foto — mossa o riccia, con volume sopra —
  //  ma con i LATI SFUMATI, che nelle foto scelte non c'era quasi mai.
  //  ⚠️ Perché la differenza non è estetica, è di età: la stessa massa di
  //   capelli con i lati pieni fa una testa larga e appesantita, con i lati
  //   sfumati fa una testa più stretta e più giovane. È il taglio che oggi
  //   chiede chi entra in un centro, ed è anche quello che sta meglio su chi
  //   ha le tempie arretrate — il volume resta dove serve, sopra.
  {
    chiave: "riccio_sfumato_pelle",
    famiglia: "sfumati",
    nome: "Riccio con sfumatura a pelle",
    descrizione: "Ricci pieni sopra, lati sfumati fino alla pelle. Il più moderno dei ricci.",
    inglese:
      "A modern curly fade: the sides and back are faded down to the skin just above the ears "
      + "and blend upward over about four centimetres, while the top keeps 5 to 6 cm of dense, "
      + "well-defined separated curls with natural volume, worn forward with no parting; the line "
      + "between the faded sides and the curly top is soft and blended, never a hard disconnection.",
  },
  {
    chiave: "mosso_sfumato_medio",
    famiglia: "sfumati",
    nome: "Mosso con sfumatura media",
    descrizione: "Onde morbide sopra, sfumatura che parte a metà. Ordinato senza essere rigido.",
    inglese:
      "A mid fade with a wavy top: the sides are clipped short and fade gradually from the "
      + "mid-point of the head down to very short at the ears and nape, while the top keeps 7 to "
      + "8 cm of soft natural waves with visible movement, styled loosely upward and back without "
      + "a defined parting, slightly undone rather than combed.",
  },
  {
    chiave: "ciuffo_mosso_sfumato",
    famiglia: "sfumati",
    nome: "Ciuffo mosso sfumato",
    descrizione: "Ciuffo mosso in avanti sulla fronte, lati sfumati bassi. Copre l'attaccatura.",
    inglese:
      "A low fade with a textured wavy fringe: the sides fade short low above the ears while the "
      + "top stays 8 to 10 cm long and is pushed forward into a soft wavy fringe that falls onto "
      + "the forehead and covers the hairline, with separated piecey strands rather than a solid "
      + "block, and no parting.",
  },
  {
    chiave: "riccio_alto_sfumato",
    famiglia: "sfumati",
    nome: "Riccio alto sfumato",
    descrizione: "Ricci alti e voluminosi sopra, lati rasati netti. Massimo contrasto.",
    inglese:
      "A high fade with a tall curly top: the sides and back are cut very short with a fade that "
      + "starts high on the head, and above it sits a compact tower of springy curls 7 to 9 cm "
      + "tall with strong volume, each curl separated; the transition is a clear but softened "
      + "step, and the front hairline of the curls sits just behind the forehead.",
  },
  {
    chiave: "mosso_indietro_rasato",
    famiglia: "sfumati",
    nome: "Mosso indietro con lati rasati",
    descrizione: "Lunghezza mossa portata indietro, lati rasati. Il taglio che allunga il viso.",
    inglese:
      "A modern undercut with a wavy top: the sides and back are clipped very short and uniform, "
      + "close to the skin, while the top keeps 10 to 12 cm of wavy hair swept straight back from "
      + "the forehead with volume at the root and visible separated strands, falling slightly to "
      + "one side at the crown; the change of length at the temples is quite sharp but the edge "
      + "itself stays soft and hair-by-hair.",
  },
  // ── ⚠️ GLI OTTO CHE IL RAGGRUPPAMENTO AVEVA MANGIATO ───────────────────
  //  Il confronto fra i campi — lati, texture, direzione, lunghezza — aveva
  //  detto «questo l'ho già» per otto foto su ventotto. Ma «già» secondo QUEI
  //  quattro campi: due mossi medi portati in avanti possono avere una frangia
  //  che cade in due modi diversi, un'onda più larga, una riga che non c'è.
  //  Chi ha scelto quelle foto le ha scelte perché sono diverse, e se n'è
  //  accorto al primo sguardo alla griglia.
  //  ⚠️ La lezione, per la prossima volta: un raggruppamento automatico si
  //   può usare per PROPORRE i doppioni, non per buttarli. La decisione di
  //   togliere un taglio dal catalogo la prende chi il catalogo lo vende.
  {
    chiave: "ricci_morbidi",
    famiglia: "ricci",
    nome: "Ricci morbidi",
    descrizione: "Come nella foto IMG_3368, riprodotto sul nostro modello.",
    inglese:
      "Short tapered sides and back; medium length and high volume on top, styled forward and upward; no discernible parting; naturally curly texture; and a full, curled fringe.",
  },
  {
    chiave: "sfumato_con_frangia",
    famiglia: "sfumati",
    nome: "Sfumato con frangia",
    descrizione: "Come nella foto IMG_3385, riprodotto sul nostro modello.",
    inglese:
      "Mid-skin fade with a clean neck line; voluminous, medium-length top swept back and to the sides with no distinct parting; wet-look curly texture; soft, layered fringe blending into the top.",
  },
  {
    chiave: "lungo_mosso_di_lato",
    famiglia: "lunghi",
    nome: "Lungo mosso di lato",
    descrizione: "Come nella foto IMG_3390, riprodotto sul nostro modello.",
    inglese:
      "Sides and back left long, past the ears, blending with the longer, voluminous top, styled loosely swept back and to the side without a distinct part, showcasing natural, thick, wavy-to-curly texture with an informal, full fringe.",
  },
  {
    chiave: "ricci_sfumatura_netta",
    famiglia: "ricci",
    nome: "Ricci con sfumatura netta",
    descrizione: "Come nella foto IMG_3392, riprodotto sul nostro modello.",
    inglese:
      "High faded sides and back, with voluminous, medium-length curly hair on top, styled forward and slightly upwards from an undefined parting, exhibiting a natural, tight coil texture and a short, messy curly fringe.",
  },
  {
    chiave: "mosso_alzato",
    famiglia: "mossi",
    nome: "Mosso alzato",
    descrizione: "Come nella foto IMG_3395, riprodotto sul nostro modello.",
    inglese:
      "Tapered sides and back, leaving length near the top; voluminous, swept-back top with a soft, undefined side parting; naturally wavy, hydrated texture with a subtle, swept fringe blending into the top.",
  },
  {
    chiave: "mosso_indietro",
    famiglia: "mossi",
    nome: "Mosso indietro",
    descrizione: "Come nella foto IMG_3396, riprodotto sul nostro modello.",
    inglese:
      "Sides and back left long, feathered, and blended, with medium-long, high-volume top styled casually backwards, no distinct parting, natural wavy texture, and a long, swept-back fringe.",
  },
  {
    chiave: "mosso_in_avanti",
    famiglia: "mossi",
    nome: "Mosso in avanti",
    descrizione: "Come nella foto IMG_3398, riprodotto sul nostro modello.",
    inglese:
      "Sides and back left long, feathered; top is medium-long with significant volume, swept back and to the sides; no distinct parting; a messy, slightly wet, wavy texture; and a long, full fringe casually pushed back and away from the face.",
  },
  {
    chiave: "mosso_con_volume",
    famiglia: "mossi",
    nome: "Mosso con volume",
    descrizione: "Come nella foto IMG_3399, riprodotto sul nostro modello.",
    inglese:
      "Tapered sides and back, left longer to blend; voluminous, curly top styled back and to the side without a distinct part; natural, wavy texture throughout, with a soft, brushed-back fringe.",
  },
  // ── ⚠️ QUESTO È DESCRITTO A PAROLE, E SI VEDE PERCHÉ ───────────────────
  //  La fotografia di riferimento è arrivata in chat e non è mai finita su un
  //  file: senza il file non si può allegare al modello, e senza allegarla si
  //  torna al metodo peggiore — descriverla. Resta più debole degli altri
  //  finché la foto non c'è: quando ci sarà, basta metterla nella cartella e
  //  rilanciare `rifai-catalogo` per questa sola chiave.
  {
    chiave: "indietro_con_onda",
    famiglia: "classici",
    nome: "Indietro con onda",
    descrizione: "Lati corti, sopra pieno portato indietro con un'onda morbida. Fronte scoperta.",
    inglese:
      "Scissor-cut short at the sides and back, tapered close over the ears but NOT faded to the "
      + "skin, with a soft outline around the ear; the top keeps 8 to 9 cm of thick hair with "
      + "substantial volume, brushed straight back and slightly to one side, lifting off the "
      + "forehead into a soft wave at the front with visible comb lines; no defined parting, no "
      + "fringe, forehead fully exposed and the hairline visible with a slight natural recession "
      + "at the temples; straight to lightly wavy texture, dense and glossy.",
  },
];


/** I tagli di una famiglia, nell'ordine in cui sono scritti qui sopra. */
export const tagliDi = (f: ChiaveFamiglia): Taglio[] => TAGLI.filter((t) => t.famiglia === f);

/** ── I COLORI: QUATTRO FAMIGLIE, QUATTRO TONI CIASCUNA ────────────────────
 *
 *  Sedici tinte, non sessantatré. L'anello del fornitore è uno strumento da
 *  laboratorio — serve a ORDINARE il capello giusto — e messo davanti a una
 *  persona che vuole solo vedersi con i capelli diventa un muro: sessanta
 *  quadretti quasi uguali, e la scelta si blocca lì.
 *  Qui ci sono i quattro colori che la gente si riconosce addosso — nero,
 *  castano, biondo, rosso — con quattro passaggi ciascuno. Chi si guarda
 *  trova il suo al primo colpo d'occhio; il codice esatto per l'ordine lo
 *  decide poi il consulente, sul cartoncino vero.
 *
 *  ── ⚠️ I CAPELLI BIANCHI NON SONO UNA TINTA ──────────────────────────────
 *  Stavano nell'anello come decine di codici (1B30, 1780H…) perché lì sono
 *  merce diversa. Qui sono una QUANTITÀ, e si regola con i due cursori sotto
 *  la griglia: si sceglie il colore e poi quanto bianco e quanto grigio
 *  mescolarci. Ripeterli come tinte a sé vorrebbe dire moltiplicare la
 *  griglia per otto e chiedere due volte la stessa cosa.
 *
 *  ── ⚠️ E OGNI TINTA HA LA SUA FOTOGRAFIA ─────────────────────────────────
 *  Il quadratino di colore pieno dice qual è il colore; una ciocca vera dice
 *  come sarà — la luce che ci corre sopra è metà dell'informazione. Le
 *  fotografie si generano dal gestionale e si depositano (vedi
 *  prova/campioni.server); finché una manca, resta il colore pieno.
 */
export interface Colore {
  chiave: string;
  nome: string;
  /** Il campione a tinta piena: si vede finché non c'è la fotografia. */
  campione: string;
  inglese: string;
  /** Il nome interno con cui si genera e si ritrova la fotografia. */
  codice?: string;
  /** Canizie propria della tinta. Zero: qui la decidono i cursori. */
  grigi?: number;
}

export type ChiaveColore = string;

/** ⚠️ IL PRIMO È «COME LA MIA BARBA», ED È IL PREDEFINITO. Chi non sceglie
 *  niente deve ottenere la cosa giusta, non un castano di prova: è il colore
 *  che rende la foto credibile, e nove volte su dieci è anche quello che la
 *  persona avrebbe scelto. */
export const COLORI: Colore[] = [
  {
    chiave: "come_barba",
    nome: "Come la mia barba",
    campione: "",
    inglese:
      "Match the hair colour EXACTLY to this person's own facial hair and remaining hair: beard, "
      + "moustache, stubble, eyebrows and any hair left at the sides and back. Copy the same tone "
      + "and the same amount of grey — if the beard is greying or white, the new hair must be "
      + "greying or white in the same measure. Do not invent a younger or darker colour.",
  },

  //  ── NERO ───────────────────────────────────────────────────────────────
  { chiave: "nero_corvino", codice: "NERO1", grigi: 0, nome: "Nero corvino", campione: "#0a0a0a", inglese: "jet black, the deepest black, no brown in it" },
  { chiave: "nero_naturale", codice: "NERO2", grigi: 0, nome: "Nero naturale", campione: "#191614", inglese: "natural off-black, the black most people actually have" },
  { chiave: "nero_morbido", codice: "NERO3", grigi: 0, nome: "Nero morbido", campione: "#241f1b", inglese: "soft black with a faint warm depth" },
  { chiave: "nero_caldo", codice: "NERO4", grigi: 0, nome: "Nero caldo", campione: "#2e2620", inglese: "very dark brown-black, warm undertone" },

  //  ── CASTANO ────────────────────────────────────────────────────────────
  { chiave: "castano_scurissimo", codice: "CASTANO1", grigi: 0, nome: "Castano scurissimo", campione: "#2e231c", inglese: "darkest brown, almost black" },
  { chiave: "castano_scuro", codice: "CASTANO2", grigi: 0, nome: "Castano scuro", campione: "#3d2d23", inglese: "dark brown" },
  { chiave: "castano_medio", codice: "CASTANO3", grigi: 0, nome: "Castano medio", campione: "#5a4231", inglese: "medium chestnut brown" },
  { chiave: "castano_chiaro", codice: "CASTANO4", grigi: 0, nome: "Castano chiaro", campione: "#7b5b3e", inglese: "light chestnut brown" },

  //  ── BIONDO ─────────────────────────────────────────────────────────────
  { chiave: "biondo_scuro", codice: "BIONDO1", grigi: 0, nome: "Biondo scuro", campione: "#8a7458", inglese: "dark blonde, muted and natural" },
  { chiave: "biondo_medio", codice: "BIONDO2", grigi: 0, nome: "Biondo medio", campione: "#a68d64", inglese: "medium natural blonde" },
  { chiave: "biondo_chiaro", codice: "BIONDO3", grigi: 0, nome: "Biondo chiaro", campione: "#c6ab7c", inglese: "light golden blonde" },
  { chiave: "biondo_platino", codice: "BIONDO4", grigi: 0, nome: "Biondo platino", campione: "#e6d7ae", inglese: "lightest platinum blonde, pale" },

  //  ── ROSSO ──────────────────────────────────────────────────────────────
  { chiave: "castano_ramato", codice: "ROSSO1", grigi: 0, nome: "Castano ramato", campione: "#4f2c22", inglese: "dark auburn brown, red showing only in the light" },
  { chiave: "rame_scuro", codice: "ROSSO2", grigi: 0, nome: "Rame scuro", campione: "#6d3625", inglese: "deep copper red brown" },
  { chiave: "rame", codice: "ROSSO3", grigi: 0, nome: "Rame", campione: "#8f4b2b", inglese: "clear copper red" },
  { chiave: "rame_chiaro", codice: "ROSSO4", grigi: 0, nome: "Rame chiaro", campione: "#b8763f", inglese: "light copper, warm and bright" },
];

/** Il colore, cercato per chiave o per nome interno. */
export const coloreDelCodice = (v: string): Colore | undefined => {
  const s = String(v || "").trim().toLowerCase();
  return COLORI.find((c) => c.chiave === s || String(c.codice || "").toLowerCase() === s);
};

export const COLORE_DA_FOTO = "da_foto";

/** ── IL TAGLIO PRESO DA UNA FOTO ───────────────────────────────────────────
 *  Come per il colore: la persona porta l'esempio invece di sceglierlo da un
 *  elenco. È la richiesta più naturale che si possa fare a una prova capelli —
 *  «voglio questo qui» — e otto caselle non la coprono mai del tutto.
 *  ⚠️ E anche qui vale solo la FORMA. Con due facce davanti il modello tende a
 *   prendere anche il colore (che si sceglie dopo, e deve vincere) e a lasciar
 *   filtrare i tratti della seconda persona in quella della prima. */
export const TAGLIO_DA_FOTO = "da_foto";



/** ── ⚠️ LE IMMAGINI SI NUMERANO ───────────────────────────────────────────
 *  Quando ne arrivano due o tre, «la seconda immagine» non basta più: se una
 *  volta si allega solo il colore e un'altra prima il taglio, «la seconda» è
 *  due cose diverse — e il modello applica alla faccia della persona il ruolo
 *  sbagliato. Qui ogni immagine viene dichiarata per numero, sempre, anche
 *  quando è una sola: costa una riga e toglie di mezzo l'errore peggiore
 *  possibile, cioè restituire un'altra persona. */
function ruoliImmagini(
  taglioDaFoto: boolean,
  coloreDaFoto: boolean,
  esempioReale = false,
): string[] {
  const righe = [
    "ATTACHED IMAGES:",
    "IMAGE 1 is THE PERSON to edit. The result must be image 1: their face, their skin, their "
      + "beard, their clothes, their background. Nothing of image 1 changes except the hair.",
  ];
  let n = 2;
  if (taglioDaFoto) {
    righe.push(
      `IMAGE ${n} is a HAIRCUT REFERENCE. Reproduce its haircut EXACTLY. Copy every one of these, `
      + "one by one:",
      "· the length at the SIDES and back — if they are faded, shaved or undercut, fade, shave or "
        + "undercut them the same way, at the same height;",
      "· the length on TOP, and how much volume it has;",
      "· the DIRECTION the hair is styled: swept back, to one side, forward, up;",
      "· the PARTING: where it is, whether it is a hard line or a soft split, or none at all;",
      "· the TEXTURE: straight, wavy, curly, piecey, smooth;",
      "· the FRINGE: whether hair falls on the forehead and how far down.",
      //  ⚠️ LA SFUMATURA È LA COSA CHE SI PERDE SEMPRE, e l'ho vista perdersi
      //   otto volte su otto mettendo le repliche accanto alle foto: il
      //   riferimento ha i lati rasati, il risultato li ha di media lunghezza.
      //   Succede perché quasi tutte le foto di taglio sono di tre quarti — la
      //   sfumatura si vede di lato — mentre il risultato è frontale, e nel
      //   dubbio il modello tiene i capelli che trova. Detta come vincolo a
      //   sé, e non dentro l'elenco, smette di perdersi.
      `If image ${n} has faded, shaved, tapered or undercut sides, the result MUST show that same `
        + "fade clearly IN THIS FRONTAL VIEW: the hair at the temples and just above the ears has "
        + "to be visibly much shorter than the hair on top, with the skin showing through it. Do "
        + "not leave the sides at medium length. This is the single feature most often lost — "
        + "check it before finishing.",
      `Ignore everything else about image ${n} — its face, its identity, its skin, its hair `
        + `COLOUR, its lighting and its background. Do NOT let image ${n}'s face influence image `
        + "1's face in any way. Adapt the haircut to image 1's own head shape, forehead height "
        + "and hairline: it must sit on THEIR head, not look pasted from another head.",
    );
    n += 1;
  }
  /** ── ⚠️ L'ESEMPIO DI REALISMO ──────────────────────────────────────────
   *  DIFETTO VISTO CON GLI OCCHI: i tagli composti uscivano come parrucche.
   *  Un taglio del catalogo arriva con la sua FOTOGRAFIA accanto e viene bene;
   *  uno composto arriva solo a parole, e le parole dicono le misure ma non
   *  dicono come stanno i capelli su una testa — quanto volume hanno davvero,
   *  quanto cranio si vede sotto, come si sfilacciano i bordi. Quei vuoti il
   *  modello li riempie con l'idea media di «capelli», che è una parrucca.
   *  ⚠️ E VA DETTO CHE NON È IL TAGLIO DA COPIARE, tre volte e in tre modi:
   *   davanti a una fotografia il modello copia la fotografia, e si ritroverebbe
   *   il taglio dell'esempio al posto di quello composto. Il testo vince, ed è
   *   scritto qui, ripetuto nel controllo finale.
   */
  if (esempioReale) {
    righe.push(
      `IMAGE ${n} is NOT the haircut to reproduce. It is a photograph of a REAL head of hair, `
      + "attached only as a lesson in what real hair looks like.",
      "Copy from it ONLY these: how hair actually sits on a skull, how much bulk it really has, "
        + "how the sides melt into the top, how the edges break up into separate strands, how the "
        + "scalp shows faintly through, how light falls along it.",
      "Do NOT copy its length, its direction, its fringe, its fade, its parting or its colour: "
        + "those are written in words above, and THE WORDS WIN over this photograph wherever the "
        + "two disagree.",
      `Ignore image ${n}'s face, identity, skin, lighting and background completely.`,
    );
    n += 1;
  }
  if (coloreDaFoto) {
    righe.push(
      `IMAGE ${n} is a COLOUR REFERENCE ONLY. Take from it exclusively the hair colour: the base `
      + "tone, the highlights, the darker roots and the amount of grey. Ignore everything else in "
      + `it — its face, its identity, its hairstyle, its hair length, its lighting and its `
      + `background. Do NOT copy image ${n}'s haircut and do NOT let its face influence image 1's `
      + "face in any way.",
    );
  }
  return righe;
}

export const tagliaDa = (c: string): Taglio | undefined => TAGLI.find((t) => t.chiave === c);
export const coloreDa = (c: string): Colore | undefined => COLORI.find((x) => x.chiave === c);

/** ── LE REGOLE CHE VALGONO SEMPRE ──────────────────────────────────────────
 *  ⚠️ Sono la parte più importante del file, e sono quasi tutte NEGATIVE. Un
 *   modello lasciato libero rifà la faccia: qui gli si dice, una per una, tutte
 *   le cose che deve lasciare esattamente com'erano. Ogni riga è un errore che
 *   questi modelli fanno da soli, non una precauzione teorica. */
const REGOLE = [
  "This is a virtual hairstyle preview for a real person who will compare it with their own photo.",
  "Edit ONLY the hair on the scalp. Everything else in the image must remain pixel-identical.",
  "Do NOT change the face in any way: keep the exact same face shape, jawline, cheeks, nose, "
    + "mouth, lips, teeth, eyes, eye colour, eyebrows, wrinkles, skin texture, skin tone, moles, "
    + "scars and blemishes. Do not smooth, slim, beautify or rejuvenate the face.",
  //  ⚠️ La riga sulla barba adesso è CONDIZIONATA: vedi `costruisciPrompt`.
  //   Restava sempre «non toccare la barba», e la barba veniva aggiunta lo
  //   stesso — il modello, guardando la foto di un taglio con la barba, la
  //   porta dietro. Una riga in mezzo a venti non basta a fermarlo: va detta
  //   anche in fondo, dove pesa.
  "Do NOT change the ears, neck, shoulders, clothing, glasses, jewellery, background, framing, "
    + "camera angle or head position.",
  "Keep the original lighting exactly: same direction, same softness, same colour temperature. "
    + "The new hair must be lit by the same light as the face, with shadows falling the same way.",
  "Keep the original photo quality: same grain, same sharpness, same colours. Do not upscale, "
    + "do not re-render the whole image, do not add a studio look.",
  "The hairline must be anatomically plausible for this person's age, forehead height and skull "
    + "shape, with a slightly irregular natural edge and fine baby hairs — never a straight drawn "
    + "line and never a wig edge.",
  "The result must look like an ordinary photograph of this same person, not like a render.",
  "Output the edited image only.",
];

/** ── ⚠️ IL CAPELLO DEVE SEMBRARE VERO, E NON CI RIESCE DA SOLO ─────────────
 *  Lasciato a sé, un modello disegna un casco: una massa unica, di un colore
 *  solo, con il bordo netto come un ritaglio e una lucentezza di plastica. Da
 *  lontano regge; a schermo pieno si vede subito che è finto, e a quel punto
 *  non si guarda più il taglio — si guarda l'errore.
 *  Ogni riga qui sotto è una di quelle cose che il vero ha e il finto non ha:
 *  i fili singoli sul bordo, i capelli ribelli, la cute che si intravede sulla
 *  riga, l'ombra che i capelli fanno sulla fronte, il colore che cambia da
 *  ciocca a ciocca, l'attaccatura MAI simmetrica. E la grana: capelli nitidi
 *  su una foto di telefono un po' sgranata sono la cosa che tradisce di più. */
const REALISMO = [
  "PHOTOREALISM — the hair must survive being looked at closely:",
  "· Render individual strands at every edge, especially against the forehead, the ears and the "
    + "background. No solid silhouette, no cut-out edge.",
  "· Add a few loose flyaway hairs, exactly as many as a real photograph has.",
  "· The scalp must be faintly visible through the hair at the parting and just behind the "
    + "hairline. Hair is never fully opaque there.",
  "· Vary the colour strand by strand: slightly darker at the roots and in the shadowed areas, "
    + "slightly lighter where the light hits. A single flat colour reads as a wig.",
  "· The hair must cast a soft shadow on the forehead, the temples and the ears, and pick up the "
    + "same reflections as the skin from the same light source.",
  //  ⚠️ L'ATTACCATURA È DOVE SI VEDE IL FALSO. Il resto della capigliatura
  //   può essere perfetto: se la linea davanti è netta e simmetrica, la foto
  //   si legge come una parrucca in un decimo di secondo — ed è esattamente
  //   quello che chi arriva qui teme di più. Sei righe solo per quel
  //   centimetro di pelle.
  "THE HAIRLINE — this is where a fake hairstyle gives itself away, treat it as the hardest part:",
  "· The hairline must NEVER be a drawn line. It is a gradient: single fine hairs first, then "
    + "sparser short hairs, then full density, over several millimetres.",
  "· It must be ASYMMETRIC and slightly irregular — one temple a little higher than the other, "
    + "small natural notches, a widow's peak only if the person's own skull suggests one.",
  "· The temples must recede naturally for a man of this age, never a flat straight juvenile line "
    + "across the forehead.",
  "· The finest hairs at the very edge must be lighter and semi-transparent where the skin shows "
    + "through them.",
  "· Wherever the new hair meets skin — forehead, temples, in front of the ears, the nape — the "
    + "transition must be gradual, with the skin still readable under the first hairs.",
  "· No sharp cut-out edge, no uniform density right up to the boundary, no shadow line where "
    + "hair and skin meet.",
  "· Density must suit this person's age: thinner and finer at the temples, never a doll-like "
    + "helmet of hair.",
  "· Match the photograph itself: same grain and noise, same sharpness, same slight blur, same "
    + "compression artefacts. Hair that is sharper than the face is the clearest sign of a fake.",
  "· No glossy plastic sheen, no painted-on look, no airbrushing.",
];

import { type Composto, descrizioneComposta, lateraliPredefiniti } from "./composto";
import { rigaLaterali } from "./laterali";
import { controlloRitocchi, righeRitocchi } from "./ritocchi";

export interface RichiestaTaglio {
  taglio: string;
  /** ── IL TAGLIO COMPOSTO ─────────────────────────────────────────────────
   *  Quando la persona non sceglie dal catalogo ma se lo costruisce: lunghezza,
   *  capello, ciuffo, direzione. Prende il posto del taglio, non si somma. */
  composto?: Composto;
  /** I laterali scelti a parte. ⚠️ Vale ANCHE per un taglio del catalogo: è
   *  la richiesta che si fa sempre — «quello, ma sfumato più basso». */
  laterali?: string;
  /** La sfumatura scelta arriva fino alla pelle. */
  pelle?: boolean;
  /** ── L'ESEMPIO DI REALISMO ──────────────────────────────────────────────
   *  È allegata la fotografia di un taglio vero somigliante, come campione di
   *  come sono fatti i capelli — non come taglio da riprodurre. Vedi
   *  `somiglianza.ts`. */
  esempioReale?: boolean;
  /** vuoto o «come_barba» = si copia dalla barba; «da_foto» = da una seconda
   *  immagine allegata */
  colore?: string;
  /** la persona ha detto di essere calva o quasi: cambia cosa si chiede */
  calvo?: boolean;
  /** il taglio arriva da una foto allegata invece che dall'elenco */
  taglioDaFoto?: boolean;
  /** ── ⚠️ LA BARBA SI TOCCA SOLO SE LO CHIEDE ────────────────────────────
   *  Spenta di suo, ed è la scelta giusta: una persona carica la foto per
   *  vedersi con i capelli, e ritrovarsi con una barba che non ha mai avuto
   *  non è una sorpresa gradita — è un risultato sbagliato, e per giunta
   *  distrae da quello che stava guardando. Chi la vuole la chiede. */
  barba?: boolean;
  /** ── ⚠️ IL TAGLIO DELLA FOTO, LETTO A PAROLE ────────────────────────────
   *  DIFETTO VISTO CON GLI OCCHI: dando al modello solo la fotografia, il
   *  taglio usciva somigliante ma non uguale — il ciuffo c'era, i lati rasati
   *  no. Un'immagine è ambigua: il modello la guarda e «interpreta», e nel
   *  dubbio conserva quello che c'è già.
   *  Una descrizione scritta invece è un elenco di vincoli: «lati sfumati a
   *  zero sopra l'orecchio» non si può interpretare. Si legge la foto una
   *  volta con un modello di testo (costa un millesimo di un'immagine) e la si
   *  allega ALLA fotografia, non al suo posto: le due insieme dicono molto più
   *  di ciascuna da sola. */
  descrizioneTaglio?: string;
  /** ── LA CANIZIE, IN PERCENTUALE ─────────────────────────────────────────
   *  Quanta parte dei capelli è BIANCA e quanta GRIGIA, da 0 a 100. Zero e
   *  zero = nessun capello bianco né grigio, che è il caso normale.
   *  ⚠️ Sono due numeri e non uno perché sono due cose diverse a vedersi: il
   *   bianco puro fa luce, il grigio medio smorza. Un uomo di sessant'anni ha
   *   spesso molto grigio e poco bianco; uno di settanta il contrario. Con un
   *   numero solo si ottiene sempre lo stesso «brizzolato» da fotografia
   *   stock, che non somiglia a nessuno. */
  bianchi?: number;
  grigi?: number;
  /** ── I RITOCCHI CHIESTI DALLA PERSONA ───────────────────────────────────
   *  Le chiavi delle modifiche standard (vedi `ritocchi.ts`) e la riga scritta
   *  a mano. ⚠️ Sono modifiche a un taglio che RESTA: il testo lo dice tre
   *  volte, perché un elenco di aggiustamenti è il modo più veloce per far
   *  reinventare tutto a un modello. */
  ritocchi?: string[];
  nota?: string;
}

/** ── ⚠️ UNA PERCENTUALE NON SI DISEGNA: SI CONTA ───────────────────────────
 *  «Il 20% dei capelli bianchi» per un modello di immagini non vuol dire
 *  niente di preciso — non ha modo di contare i capelli. Quello che sa fare è
 *  seguire un'istruzione CONCRETA: «uno su cinque». Quindi ogni percentuale si
 *  scrive due volte, in cifre e in ciocche, e si dice anche DOVE stanno: la
 *  canizie vera non è sparsa a caso, comincia dalle tempie e dalle basette e
 *  sale verso l'alto. Senza quella riga esce una spolverata uniforme che si
 *  riconosce subito come finta.
 */
function inCiocche(p: number): string {
  const q = Math.max(0, Math.min(100, Math.round(p)));
  if (q <= 0) return "";
  if (q >= 95) return "essentially every strand";
  const su10 = Math.round(q / 10);
  if (q < 8) return "roughly 1 strand in every 20";
  if (su10 <= 1) return "roughly 1 strand in every 10";
  return `roughly ${su10} strands out of every 10`;
}

/** Le righe che descrivono la canizie richiesta. Vuoto = nessuna. */
/** Quanto è chiara una tinta, da 0 (nero) a 255 (bianco). */
export function chiarezzaDi(hex: string): number {
  const n = String(hex || "").replace("#", "");
  if (n.length < 6) return 0;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** ⚠️ Oltre questa soglia una base è «chiara»: biondo chiaro, platino, rame
 *  chiaro. Sopra di essa il grigio smette di comportarsi come un colore da
 *  aggiungere e diventa una sfumatura di freddo. */
export const BASE_CHIARA = 150;

export function righeCanizie(bianchi = 0, grigi = 0, baseChiara = false): string[] {
  //  ⚠️ `NaN` non è zero: passa attraverso ogni `Math.max`/`Math.min` senza
  //   farsi fermare, e `NaN <= 0` è falso — quindi una richiesta con dentro
  //   un valore non numerico avrebbe prodotto una riga «NaN% dei capelli
  //   bianchi» mandata al modello, e pagata.
  const num = (v: unknown) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  };
  const b = num(bianchi);
  const g = Math.min(num(grigi), 100 - b);
  if (b + g <= 0) return [];
  const pezzi: string[] = [];
  if (b > 0) pezzi.push(`${b}% of the strands must be PURE WHITE (${inCiocche(b)})`);
  if (g > 0) pezzi.push(`${g}% must be MID GREY, clearly grey and not white (${inCiocche(g)})`);
  return [
    `GREYING — this is a precise requirement, not a suggestion: ${pezzi.join(", and ")}. `
      + `The remaining ${100 - b - g}% keeps the base colour described above.`,
    /** ── ⚠️ TRE COLORI, NON QUATTRO ──────────────────────────────────────
     *  DIFETTO VISTO: scelto il biondo con una percentuale di bianchi e grigi,
     *  in mezzo sono comparse ciocche NERE — il colore vero della persona.
     *  Succede perché «una parte bianca, una parte grigia, il resto del colore
     *  scelto» lascia al modello l'idea di una testa a più toni, e il tono
     *  scuro più a portata di mano è quello che ha già davanti nella
     *  fotografia. Va chiuso: dentro questa testa esistono TRE colori e
     *  nessun altro. */
    "In this hair there are exactly three colours and nothing else: the base colour described "
      + "above, pure white, and mid grey. Every strand that is not white or grey must be EXACTLY "
      + "that base colour — never the person's original hair colour, never black or dark brown "
      + "strands unless the base colour itself is black or dark brown, and never a fourth tone "
      + "borrowed from the photograph.",
    //  ⚠️ Dove sta il grigio: senza questa riga il modello lo distribuisce a
    //   spolverata uniforme, che è il modo esatto in cui NON incanutisce una
    //   testa vera.
    "Distribute the greying the way real hair greys: densest at the temples and sideburns, "
      + "then the area above the ears, then scattered through the top; the nape and the back "
      + "stay the darkest. Individual white and grey strands must be mixed IN AMONG the "
      + "coloured ones, strand by strand — never as a patch, a streak, a highlighted section "
      + "or a two-tone split between one side of the head and the other.",
    /** ── ⚠️ SU UNA BASE CHIARA IL GRIGIO NON SI DIPINGE ──────────────────
     *  DIFETTO SEGNALATO: biondo con 30% bianchi e 30% grigi, ed è uscito un
     *  colore senza senso. Il testo era coerente — il difetto è fisico. Su una
     *  testa bionda i capelli bianchi quasi non si distinguono: nella realtà
     *  un biondo che incanutisce diventa più freddo e più pallido, non
     *  grigio a chiazze. Chiedendo «30% grigio medio» su un biondo, il modello
     *  fa l'unica cosa che quelle parole permettono — ci passa sopra il
     *  grigio — e viene fuori una massa sporca.
     *  Qui glielo si dice: stessa quantità, ma resa come tono, non come
     *  pittura. */
    ...(baseChiara
      ? ["IMPORTANT — this base colour is already very light. On light hair, white and grey "
        + "strands are barely distinguishable from the base: do NOT paint grey over it. Render "
        + "the greying as strands that are COOLER, ASHIER and slightly paler than the base, "
        + "staying at the same lightness, so the head reads as a light head of hair that is "
        + "greying — never as a grey or dirty mass, and never as dark grey strands on a light "
        + "background."]
      : []),
  ];
}

/** ── I LATERALI: LA PARTE CHE IL MODELLO NON RIFÀ MAI ─────────────────────
 *
 *  DIFETTO VISTO CON GLI OCCHI, e sono due difetti in uno:
 *   · i lati restavano quelli VERI della persona — corti e grigi — mentre la
 *     sommità era nuova e bionda. Un risultato con la testa di due colori;
 *   · e quando li rifaceva, li sfumava a zero comunque, anche su tagli che una
 *     sfumatura non ce l'hanno.
 *  Perché succede: il modello legge «cambia i capelli» e guarda la sommità,
 *  che è dove il cambiamento si vede. I lati, già corti, gli sembrano a posto —
 *  e la cosa più economica che può fare è lasciarli e raccordarli, cioè
 *  sfumarli.
 *  Serve dirlo esplicitamente e in due tempi: i lati SONO parte del taglio
 *  nuovo (stesso colore, stessa mano), e la sfumatura si fa SOLO se il taglio
 *  scelto la prevede.
 */
export function righeLaterali(
  descrizione: string,
  sfumaturaChiesta: boolean,
  istruzione = "",
): string[] {
  /** ── ⚠️ QUANDO I LATERALI LI SCEGLIE LA PERSONA, VINCONO ────────────────
   *  Qui sotto la sfumatura si DEDUCE dalle parole del taglio: è quello che
   *  serve finché nessuno ha detto niente. Ma se la scelta c'è, dedurre è
   *  peggio che tacere — su un taglio che si chiama «sfumato alto» la
   *  deduzione direbbe «sfuma alto» e la scelta «sfuma basso», e di due frasi
   *  che si contraddicono il modello ne inventa una terza. */
  if (istruzione) {
    return [
      "THE SIDES AND THE BACK ARE PART OF THE NEW HAIRCUT, not leftovers: they must be re-created "
        + "together with the top, in the SAME colour as the top and with the same amount of grey. "
        + "Whatever hair the person has at the sides now must not survive.",
      istruzione,
    ];
  }
  //  ⚠️ La sfumatura si concede solo se il taglio la nomina davvero: sono le
  //   parole con cui un barbiere la scrive, ed è l'unico modo per distinguere
  //   «sfumato» da «corto ai lati».
  const prevista = sfumaturaChiesta
    || /\bfade|faded|fading|taper|tapered|undercut|shaved|buzz|skin\b/i.test(String(descrizione || ""));
  return [
    "THE SIDES AND THE BACK ARE PART OF THE NEW HAIRCUT, not leftovers: they must be re-created "
      + "together with the top, in the SAME colour as the top and with the same amount of grey. "
      + "Whatever hair the person has at the sides now — short, thin, greying, a different colour "
      + "— must not survive: it is replaced, exactly like the rest.",
    prevista
      ? "This haircut IS faded/tapered at the sides: show that fade clearly, at the height the "
        + "haircut calls for, and keep it clean and gradual."
      : "This haircut is NOT a fade: do NOT fade, taper, buzz, undercut or shave the sides down to "
        + "the skin, and do not invent a shaved outline. Keep the sides at the length this haircut "
        + "calls for — trimmed and tidy, following the shape of the head, blending smoothly into "
        + "the top — and never shorter than the haircut requires.",
  ];
}

/** Il testo completo da mandare al modello. */
export function costruisciPrompt(r: RichiestaTaglio): string {
  const t = tagliaDa(r.taglio);
  //  ⚠️ Senza taglio non si scrive un testo a metà: si restituisce niente, e
  //   la porta lo rifiuta prima di spendere una generazione. L'unica eccezione
  //   è il taglio portato in fotografia, che di suo non ha una chiave.
  const composto = descrizioneComposta(r.composto);
  if (!t && !r.taglioDaFoto && !composto) return "";
  const daFoto = r.colore === COLORE_DA_FOTO;
  const c = coloreDa(r.colore || "come_barba") ?? COLORI[0];

  //  ⚠️ «AGGIUNGI» E «SOSTITUISCI» SONO DUE LAVORI DIVERSI. Su una testa
  //   calva il modello deve costruire una capigliatura dove non c'è niente e
  //   raccordarla alla pelle; su una testa con i capelli deve toglierli e
  //   rimetterli. Chiedendo sempre «sostituisci», sulle teste calve capitava
  //   che il modello lasciasse la pelle e ci appoggiasse sopra una parrucca —
  //   staccata, con un bordo netto che si vede subito.
  /** ── ⚠️ NON SI RITOCCA: SI TOGLIE TUTTO E SI RIFÀ ──────────────────────
   *  DIFETTO VISTO CON GLI OCCHI: chiedendo il colore da una fotografia, il
   *  risultato è uscito mezzo grigio e mezzo scuro — i capelli grigi che la
   *  persona aveva davvero erano rimasti lì sotto, e il nuovo colore ci si era
   *  posato sopra a chiazze. «Replace the hairstyle» non basta: per un modello
   *  vuol dire ritoccare quello che c'è, e quello che c'è vince sempre.
   *  L'istruzione giusta è in due tempi — prima immagina la testa RASATA, poi
   *  costruisci la capigliatura nuova da zero — perché toglie al modello il
   *  materiale di partenza a cui aggrapparsi. */
  const gesto = r.calvo
    ? "This person is bald or has very little hair. GROW a full, natural head of hair on the bald "
      + "scalp: the new hair must start from the skin with a soft, gradual, believable hairline and "
      + "blend into whatever hair remains at the sides and back. No wig, no hairpiece edge, no hat."
    : "STEP 1 — mentally REMOVE every single hair this person currently has on their head: imagine "
      + "the scalp completely shaved, keeping only the face, the ears and the skin. "
      + "STEP 2 — build a brand new head of hair on that bare scalp, following the haircut and the "
      + "colour described below. "
      + "The previous hairstyle, its length, its shape and above all ITS COLOUR must leave no trace: "
      + "no surviving strands, no old colour showing at the roots, at the temples, at the parting or "
      + "at the nape, no mixture of the old hair with the new. Blend the new hair naturally into the "
      + "scalp and around the ears, with a soft believable hairline.";

  /** ── ⚠️ IL COLORE SCELTO DEVE VINCERE SULLA BARBA ────────────────────────
   *  DIFETTO VERO, SEGNALATO: scelto «castano», è uscito un castano
   *  brizzolato. Non è un capriccio del modello — è quello che gli abbiamo
   *  chiesto senza volerlo: gli si dice «non toccare la barba» e «guarda i
   *  capelli rimasti», e lui, davanti a una barba brizzolata, ci porta dentro
   *  il grigio perché sembra la cosa coerente da fare.
   *  Quando un colore lo sceglie la persona, quindi, non basta nominarlo: va
   *  detto che SOSTITUISCE ogni indizio preso dalla faccia, e va detto anche
   *  che il grigio non ci va — perché «castano» e «castano con i grigi» per un
   *  modello sono lo stesso colore, per chi si guarda no.
   *  ⚠️ E si ripete in fondo: l'ultima riga di un prompt pesa più delle altre,
   *   ed è lì che si perdeva. */
  const scelto = !daFoto && c.chiave !== "come_barba";
  //  ⚠️ La canizie CHIESTA vince su tutto il resto: se la persona ha detto
  //   «voglio il 20% di bianchi» non ha senso continuare a ripetere «niente
  //   grigio da nessuna parte», e nemmeno lasciar decidere al colore
  //   brizzolato del listino quanto grigio mettere.
  //  ⚠️ Un codice dell'anello porta con sé la sua canizie: `1B30` VUOL DIRE
  //   trenta per cento di grigio, e non dirlo al modello vorrebbe dire
  //   mostrare a schermo un campione grigio e generare una testa nera. I
  //   cursori, quando toccati, vincono: sono una scelta esplicita.
  const grigiRichiesti = Number(r.grigi) || 0;
  const bianchiRichiesti = Number(r.bianchi) || 0;
  //  ⚠️ La canizie si comporta diversamente su una base chiara: vedi la nota
  //   dentro `righeCanizie`. È il difetto del «biondo con il 60% di grigio»
  //   uscito senza senso.
  const baseChiara = !daFoto && chiarezzaDi(c.campione) > BASE_CHIARA;
  const canizie = bianchiRichiesti + grigiRichiesti > 0
    ? righeCanizie(bianchiRichiesti, grigiRichiesti, baseChiara)
    : righeCanizie(0, c.grigi ?? 0, baseChiara);
  const conCanizie = canizie.length > 0;
  //  ⚠️ «Brizzolato» adesso è un DATO, non una parola nella chiave: ogni
  //   codice dell'anello dice quanta canizie porta con sé, e i cursori possono
  //   sovrascriverla. Il vecchio controllo cercava «grigio» dentro il nome
  //   della chiave, e con i codici veri (1B30, 1765H) non avrebbe più trovato
  //   niente: la riga «niente grigio da nessuna parte» sarebbe finita anche su
  //   una tinta che di grigio ne ha l'ottanta per cento.
  const brizzola = conCanizie || (c.grigi ?? 0) > 0;
  const colorePreciso = scelto
    ? [
        `Hair colour: ${c.inglese} (approximately ${c.campione}).`,
        "This colour is a DELIBERATE CHOICE and it OVERRIDES every colour cue on the person: do "
          + "not sample the colour from their beard, moustache, eyebrows or remaining hair, and do "
          + "not blend towards those.",
        ...(brizzola
          ? []
          : [
              "The hair must be a single consistent colour with natural strand-to-strand variation "
                + "ONLY. Absolutely NO grey, NO white and NO salt-and-pepper strands anywhere — not "
                + "at the temples, not at the roots, not scattered through. The person's beard may "
                + "stay grey; the hair must not.",
            ]),
      ]
    : [];

  return [
    REGOLE[0],
    ...ruoliImmagini(!!r.taglioDaFoto, daFoto, !!r.esempioReale && !r.taglioDaFoto),
    gesto,
    r.taglioDaFoto
      ? (String(r.descrizioneTaglio || "").trim()
          ? `Reproduce the haircut shown in the haircut reference image. That haircut is: ${String(r.descrizioneTaglio).trim()}`
          : "Reproduce the haircut shown in the haircut reference image.")
      //  ⚠️ Il taglio composto NON è una fotografia da imitare: è un elenco di
      //   misure. Va detto per intero qui, dove sta la riga del taglio, se no
      //   il modello non ha nessun taglio da fare.
      : composto
        ? `The new hairstyle is: ${composto}.`
        : `The new hairstyle is: ${t!.inglese}.`,
    //  ⚠️ Subito DOPO il taglio e PRIMA del colore: sono ritocchi a quello che
    //   si è appena descritto, e messi altrove il modello non sa più a cosa si
    //   riferiscano.
    ...righeRitocchi(r.ritocchi, r.nota),
    //  ⚠️ E i laterali si nominano SEMPRE: è la parte che il modello lascia
    //   com'era, o sfuma di sua iniziativa. Vedi righeLaterali.
    ...righeLaterali(
      r.taglioDaFoto ? String(r.descrizioneTaglio || "") : composto || String(t?.inglese || ""),
      Array.isArray(r.ritocchi) && r.ritocchi.includes("lati_corti"),
      //  ⚠️ Su un taglio composto, se nessuno ha scelto i laterali, il
      //   predefinito NON è il silenzio: il silenzio faceva finire la regola
      //   generale su «non è una sfumatura», cioè lati lunghi come il sopra —
      //   il casco. Vedi lateraliPredefiniti.
      rigaLaterali(String(r.laterali || ""), !!r.pelle)
        || (r.composto ? lateraliPredefiniti(r.composto) : ""),
    ),
    daFoto
      ? "HAIR COLOUR — take it from the colour reference image, and take ONLY that: not its "
        + "haircut, not its length, not its lighting, not the person. Look at the MID-LENGTHS of "
        + "the hair in that image, in the light it is lit by, and reproduce that exact tone — its "
        + "lightness AND its warmth or coolness. If that hair is grey, silver or white, the new "
        + "hair must be grey, silver or white to the same degree, over the WHOLE head. "
        + "This colour OVERRIDES every colour cue on the person being edited: do not sample from "
        + "their beard, their eyebrows or the hair they have now, and do not compromise between "
        + "the reference and what they already had."
      : c.chiave === "come_barba" ? c.inglese : "",
    ...colorePreciso,
    //  ⚠️ Le percentuali stanno DOPO il colore di base: prima si dice di che
    //   colore sono i capelli, poi quanta parte di quei capelli è bianca o
    //   grigia. Invertendo, il modello legge «bianco» come colore di base.
    ...canizie,
    //  ── ⚠️ LA BARBA: DUE RIGHE OPPOSTE, MAI NESSUNA ────────────────────
    //   Spenta, si dice di non toccarla; accesa, si dice cosa farne. Lasciare
    //   il silenzio vorrebbe dire lasciar decidere al modello — che, con una
    //   foto di riferimento barbuta davanti, la barba la mette sempre.
    r.barba
      ? "The person may also be given facial hair that suits this haircut: a short, natural, "
        + "well-groomed beard in the same colour as the new hair, following their own jaw and "
        + "cheek line. Keep it realistic and modest — no costume beard, no change to the face "
        + "underneath, and if they already have a beard just tidy it to match the cut."
      : "Do NOT change the beard, moustache or stubble in any way: same shape, same length, same "
        + "density, same colour, same greying. If the person has no beard, do NOT add one. If the "
        + "haircut reference photo shows a beard, ignore it completely — it belongs to that other "
        + "person, not to this one.",
    ...REGOLE.slice(1),
    ...REALISMO,
    //  ── ⚠️ UN SOLO CONTROLLO FINALE, NON DUE ────────────────────────────
    //   L'ultima riga è quella che pesa di più, e per un po' se la sono
    //   contesa in due: il colore da ricontrollare e il taglio da confrontare.
    //   Due «controlla alla fine» uno dietro l'altro vogliono dire che uno dei
    //   due diventa penultimo, cioè conta meno — e quale, a caso. Qui sono un
    //   elenco solo, e ci sta dentro quello che serve a questa richiesta.
    //   ⚠️ «CONFRONTA» OTTIENE PIÙ DI «COPIA»: «fallo uguale» si accontenta
    //    della somiglianza, «guarda se è uguale e correggi» costringe a un
    //    secondo passaggio sulla fotografia. Si vede a schermo.
    //  ⚠️ IL CONTROLLO FINALE C'È SEMPRE, non solo quando c'è un colore scelto
    //   o una foto di riferimento. Ci stavano dentro anche «la faccia deve
    //   restare la sua» e «la barba non si tocca», e senza quelle due righe —
    //   cioè su un taglio del catalogo col colore della barba, che è il caso
    //   più comune di tutti — il modello restava senza l'ultima parola. Era
    //   esattamente il difetto della barba aggiunta da sola.
    "FINAL CHECK before you output the image — go through this list and fix anything that "
      + "does not match:",
    ...(r.taglioDaFoto
      ? ["· the haircut: compare your result with the haircut reference image side by side. "
        + "The length at the sides, the shape of the outline, the direction of the styling, "
        + "the texture and the way the front hair falls must MATCH it."]
      : []),
    ...(scelto
      ? [`· the colour: the hair must read unmistakably as ${c.inglese}${brizzola ? "" : ", with no grey strands anywhere"}.`]
      : []),
    //  ⚠️ MANCAVA, ed era il buco: con il colore preso da una fotografia
    //   l'ultima riga non nominava mai il colore. Il risultato è uscito col
    //   riferimento grigio usato solo sui lati e la sommità scura — cioè un
    //   compromesso fra la foto e i capelli veri, che è esattamente quello
    //   che si ottiene quando nessuno ha l'ultima parola.
    ...(daFoto
      ? ["· the colour: hold your result next to the colour reference image. The TOP of the head "
        + "must be the same colour as that reference, not just the sides. If they differ — one "
        + "darker, one greyer, one warmer — correct your result towards the reference. A head "
        + "that is dark on top and grey at the sides is WRONG unless the reference itself is."]
      : []),
    //  ⚠️ La canizie si ricontrolla in fondo, e si chiede di CONTARE: è
    //   l'unico modo per ottenere una proporzione invece di una spolverata a
    //   sentimento. E si nomina il difetto da evitare — mezza testa di un
    //   colore e mezza dell'altro — perché è esattamente quello che è uscito
    //   la prima volta.
    //  ⚠️ Il quarto colore si ricontrolla in fondo: le ciocche nere comparse
    //   in mezzo a un biondo erano quelle vere della persona, ed è l'ultima
    //   riga che le può togliere.
    ...(conCanizie
      ? ["· only three colours: the base colour, white and grey. If you can see strands of the "
        + "person's ORIGINAL hair colour anywhere — black, dark brown, whatever they had — remove "
        + "them and repaint them in the base colour."]
      : []),
    ...(conCanizie
      ? [`· the greying: count the strands. About ${Math.round(r.bianchi || 0)}% pure white and `
        + `${Math.round(r.grigi || 0)}% mid grey, mixed strand by strand among the coloured ones and `
        + "densest at the temples. NOT a patch, NOT a streak, NOT one half of the head grey and the "
        + "other half dark."]
      : []),
    //  ⚠️ Vale SEMPRE su una testa che i capelli ce li ha, con o senza
    //   canizie chiesta: il mezzo grigio e mezzo scuro nasce proprio dai
    //   capelli vecchi sopravvissuti sotto quelli nuovi.
    ...(!r.calvo
      ? ["· no leftovers: none of the person's original hair colour may survive anywhere — not at "
        + "the roots, not at the temples, not at the nape."]
      : []),
    //  ⚠️ In fondo, dove pesa: erano i due difetti visti insieme in una sola
    //   immagine — lati grigi sotto una sommità bionda, e sfumati a zero su un
    //   taglio che sfumato non è.
    "· the sides and the back: same colour as the top (no leftover grey or darker hair from the "
      + "original photo), and the length must match the haircut you were asked to reproduce — "
      + "faded only if that haircut is a fade.",
    ...controlloRitocchi(r.ritocchi, r.nota),
    ...(composto
      ? ["· the proportion: the hair must follow this person's skull and add volume WITHOUT making "
        + "the head bigger or taller. Seen from the front the outline can be only slightly wider "
        + "than the skull, and the sides must hug the head. A tall, wide or perfectly even mass of "
        + "hair is a wig — thin it down, let the outline break into strands and let the scalp show "
        + "faintly at the parting."]
      : []),
    "· the face: it must still be exactly the person of image 1, unchanged.",
    //  ⚠️ In fondo, dove pesa: la barba aggiunta di sua iniziativa è il difetto
    //   che si è visto, e una riga in mezzo alle venti non bastava a fermarlo.
    r.barba
      ? "· the beard: it must suit the cut and look natural, never a costume beard."
      : "· the beard: exactly as in image 1. If there was no beard, there must be no beard.",
  ].filter(Boolean).join("\n");
}

/** ── LE FOTO CHE NON VANNO ─────────────────────────────────────────────────
 *  ⚠️ Si controlla PRIMA di spendere una generazione. Una foto da otto mega
 *   parte, costa, e torna storta: meglio dirlo subito, e dirlo in modo che si
 *   capisca cosa cambiare. */
export const PESO_MASSIMO = 6 * 1024 * 1024;

export function fotoAccettabile(dataUrl: string): { ok: boolean; perche?: string } {
  const s = String(dataUrl || "");
  const m = /^data:(image\/(jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(s);
  if (!m) return { ok: false, perche: "La foto deve essere un'immagine JPG, PNG o WEBP." };
  //  base64 pesa un terzo in più dei byte veri.
  const byte = Math.floor((m[3].length * 3) / 4);
  if (byte < 8 * 1024) return { ok: false, perche: "La foto è troppo piccola per riconoscere il viso." };
  if (byte > PESO_MASSIMO) return { ok: false, perche: "La foto è troppo pesante: riprova con uno scatto più piccolo." };
  return { ok: true };
}
