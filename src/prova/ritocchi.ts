/** ── I RITOCCHI AL TAGLIO SCELTO ───────────────────────────────────────────
 *
 *  Un taglio del catalogo è un punto di partenza, non un vestito su misura:
 *  «quello, ma più corto ai lati» è la frase che dice chiunque si sieda su una
 *  poltrona da barbiere. Qui ci sono le cinque richieste che tornano sempre,
 *  più una riga libera per tutto il resto.
 *
 *  ── ⚠️ RITOCCARE NON È RIFARE ────────────────────────────────────────────
 *  Il pericolo di questa funzione è che il modello, ricevuto un elenco di
 *  aggiustamenti, si senta autorizzato a reinventare il taglio — e la persona
 *  si ritrovi qualcosa che col riquadro che ha toccato non c'entra più niente.
 *  Perciò ogni ritocco è scritto come una MODIFICA a una cosa che resta: si
 *  nomina il taglio di partenza, si dice cosa cambia, e si ripete che il resto
 *  non si tocca. La stessa regola vale per la nota libera.
 *
 *  ── ⚠️ CINQUE, E TUTTE COMBINABILI ───────────────────────────────────────
 *  Non sono cinque a caso: sono le cinque cose che si possono chiedere INSIEME
 *  senza contraddirsi. «Più corto ai lati» e «più lungo sopra» stanno bene
 *  assieme (è il taglio più richiesto degli ultimi dieci anni); «più mosso» e
 *  «più liscio» no — e infatti la seconda non c'è.
 */
export interface Ritocco {
  chiave: string;
  /** ── ⚠️ A QUALI TAGLI HA SENSO CHIEDERLO ────────────────────────────────
   *  «Con la riga di lato» davanti a un rasato è una richiesta impossibile, e
   *  offrirla è peggio che non offrirla: la persona la spunta, il risultato
   *  non cambia, e da fuori sembra che il programma la ignori. Ogni ritocco
   *  dice per quali famiglie vale; vuoto = per tutte. */
  famiglie?: string[];
  /** come si legge a schermo */
  nome: string;
  /** la riga sotto: dice che cosa cambia davvero */
  nota: string;
  /** l'istruzione, scritta come modifica e non come nuovo taglio */
  inglese: string;
}

export const RITOCCHI: Ritocco[] = [
  {
    chiave: "lati_corti",
    //  ⚠️ Non sui lunghi: lì i lati sono il taglio, accorciarli è un altro
    //   taglio — ed è la richiesta che manda a monte quello scelto.
    famiglie: ["sfumati", "classici", "mossi", "ricci"],
    nome: "Più corto ai lati",
    nota: "Sfumatura più bassa e pulita sopra le orecchie",
    inglese: "make the SIDES and the back shorter and cleaner than in the reference — take the "
      + "fade lower and tighter above the ears and around the nape — while keeping the length "
      + "and the shape on top exactly as they are",
  },
  {
    chiave: "sopra_lungo",
    nome: "Più lungo sopra",
    nota: "Più materiale in cima, stessa sfumatura ai lati",
    inglese: "leave more length and more volume ON TOP than in the reference, so there is more "
      + "hair to style, without changing the sides, the back or the outline",
  },
  {
    chiave: "attaccatura_bassa",
    nome: "Attaccatura più bassa",
    nota: "Fronte meno scoperta, tempie più piene",
    inglese: "bring the HAIRLINE slightly further forward on the forehead and fill the temples, "
      + "so the forehead looks less exposed — keep it soft and irregular, never a straight drawn "
      + "line, and change nothing else about the cut",
  },
  {
    chiave: "riga_laterale",
    //  ⚠️ La riga vuole capelli da spostare: su un riccio si perde nel volume,
    //   e sui tagli corti non c'è materiale con cui farla.
    famiglie: ["sfumati", "classici", "lunghi", "mossi"],
    nome: "Con la riga di lato",
    nota: "Capelli portati da un lato invece che all'indietro",
    inglese: "style the same cut with a SIDE PARTING, sweeping the top hair to one side instead "
      + "of straight back, keeping the same lengths",
  },
  {
    chiave: "piu_ordinato",
    //  ⚠️ Ha senso dove c'è del disordine da mettere a posto: su un classico
    //   con la riga «più ordinato» non promette niente di nuovo.
    famiglie: ["mossi", "ricci", "lunghi", "sfumati"],
    nome: "Più ordinato",
    nota: "Meno spettinato, aspetto più curato",
    inglese: "finish the same cut more neatly: less messy, less flyaway, hair sitting where it "
      + "should, as if it had just been styled — same lengths, same shape, only tidier",
  },
  {
    chiave: "riccio_definito",
    nome: "Riccio più definito",
    nota: "Onde e ricci più disegnati, meno crespo",
    inglese: "define the curls and waves better than in the reference: separated, springy, "
      + "shaped locks instead of a frizzy or flat mass — same length, same cut, only better "
      + "defined",
    //  Ha senso solo dove un riccio c'è: altrove è una promessa che non si può
    //  mantenere senza cambiare il taglio.
    famiglie: ["mossi", "ricci"],
  },
  {
    chiave: "ciuffo_alto",
    nome: "Ciuffo più alto",
    nota: "Più volume davanti, capelli portati su",
    inglese: "give the front section more height and lift, styled upwards and slightly back, "
      + "keeping the sides and the overall length exactly as they are",
    //  Vuole capelli sopra da alzare: su un lungo o un riccio non è un ritocco,
    //  è un'altra pettinatura.
    famiglie: ["sfumati", "classici"],
  },
];

/** ── I RITOCCHI CHE HANNO SENSO PER QUESTO TAGLIO ──────────────────────────
 *  ⚠️ Offrire un'opzione impossibile è peggio che non offrirla: la persona la
 *   spunta, il risultato non cambia, e da fuori sembra che il programma
 *   ignori quello che le si chiede. Meglio tre voci vere che cinque di cui due
 *   non funzionano.
 *  ⚠️ Senza famiglia — un taglio aggiunto a mano, o una foto caricata — si
 *   mostrano quelli buoni per tutti: nel dubbio si offre il meno specifico,
 *   mai il più rischioso.
 */
export function ritocchiPer(famiglia?: string): Ritocco[] {
  const f = String(famiglia || "").trim();
  if (f) return RITOCCHI.filter((r) => !r.famiglie || r.famiglie.includes(f));
  //  ── ⚠️ TAGLIO SENZA FAMIGLIA: UNA FOTO CARICATA ────────────────────────
  //   Qui la famiglia non si sa — è la fotografia che ha portato la persona —
  //   e restare ai soli ritocchi universali lasciava due voci in croce, cioè
  //   un popup che non serve a niente. Si offrono quelli LARGHI (validi per
  //   quasi tutte le famiglie) e si tengono fuori solo i due davvero
  //   specifici: il riccio da definire e il ciuffo da alzare, che su un taglio
  //   sconosciuto sono una promessa a caso.
  return RITOCCHI.filter((r) => !r.famiglie || r.famiglie.length >= 3);
}

/** Gli esempi che si mostrano sotto la nota. ⚠️ Sono esempi di RITOCCHI, non di
 *  tagli: «voglio i capelli lunghi» qui non è una nota, è un altro taglio — e
 *  chi lo scrive resta deluso. Suggerire le frasi giuste è il modo più
 *  economico per non ricevere quelle sbagliate. */
export const ESEMPI_NOTA = [
  "Un po' più corto sulla nuca",
  "Ciuffo meno alto",
  "Basette più corte",
  "Riga a sinistra",
];

/** La nota, ripulita. ⚠️ Finisce dentro un testo mandato a un modello: gli a
 *  capo la spezzerebbero in righe che sembrano istruzioni nuove, e senza un
 *  tetto una persona potrebbe incollarci dentro una pagina intera — pagata da
 *  noi e per giunta capace di scavalcare tutte le regole scritte prima. */
export const NOTA_MASSIMA = 200;
export function notaPulita(s: unknown): string {
  return String(s ?? "").replace(/\s+/g, " ").trim().slice(0, NOTA_MASSIMA);
}

export const trovaRitocco = (chiave: string): Ritocco | undefined =>
  RITOCCHI.find((r) => r.chiave === chiave);

/** Le righe da mettere nel testo per il modello. Vuoto = nessun ritocco. */
export function righeRitocchi(scelti: unknown, nota: unknown): string[] {
  const chiavi = Array.isArray(scelti) ? scelti.map(String) : [];
  const voci = RITOCCHI.filter((r) => chiavi.includes(r.chiave));
  const libera = notaPulita(nota);
  if (!voci.length && !libera) return [];

  return [
    "SMALL ADJUSTMENTS — the haircut described above is the STARTING POINT and it stays: same "
      + "cut, same character, same overall shape. Apply only the following changes to it:",
    ...voci.map((v) => `· ${v.inglese};`),
    //  ⚠️ La nota della persona sta DOPO le voci scelte e dichiarata come tale:
    //   se fosse mescolata alle altre righe, una frase scritta di getto
    //   peserebbe come un'istruzione di sistema. Così resta una richiesta.
    ...(libera ? [`· the person also asked, in their own words: "${libera}" — honour it if it is a `
      + "small adjustment to this haircut; ignore it if it asks for a different haircut, a "
      + "different person, or anything about the face."] : []),
    "These are adjustments, NOT a new hairstyle: after applying them the result must still be "
      + "immediately recognisable as the same haircut you were given. Do not restyle anything "
      + "that was not listed here.",
  ];
}

/** La riga del controllo finale, quando ci sono ritocchi. */
export function controlloRitocchi(scelti: unknown, nota: unknown): string[] {
  const righe = righeRitocchi(scelti, nota);
  if (!righe.length) return [];
  return ["· the adjustments: every small change requested must be clearly visible in the result, "
    + "and at the same time the haircut must still read as the one you were asked to reproduce — "
    + "not a different cut that happens to include those changes."];
}
