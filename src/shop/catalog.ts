// Catalogo e-commerce Hair Genius — protesi (toupee) e prodotti per la cura.
// Prezzi in EUR. Le protesi usano illustrazioni SVG accurate (HairSystemVisual)
// che rappresentano la reale costruzione della base; i prodotti di cura usano
// il placeholder a gradiente (ProductVisual).

export type CategoryKey =
  | "toupee"
  | "shampoo"
  | "balsamo"
  | "districanti"
  | "solventi"
  | "adesivi"
  | "spazzole"
  | "kit"
  | "accessori";

// Stile costruttivo della base — guida il disegno SVG.
export type BaseStyle = "lace" | "skin" | "mono" | "silk" | "hybrid";
// Tipo di onda per il disegno dei capelli.
export type WaveStyle = "straight" | "wavy" | "curly";

export interface Category {
  key: CategoryKey;
  label: string;
  tagline: string;
  icon: string;
}

export interface Variant {
  label: string;
  options: string[];
}

export interface Spec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: CategoryKey;
  price: number;
  compareAt?: number;
  short: string;
  description: string;
  bullets: string[];
  badges?: string[];
  tone: "brand" | "violet" | "cyan" | "amber" | "emerald" | "slate";
  icon: string;
  variants?: Variant[];
  rating: number;
  reviews: number;
  stock: number;
  // Foto prodotto: se presente viene usata al posto dell'illustrazione SVG.
  // Metti qui l'URL di una TUA foto (o royalty-free/con licenza), oppure importa
  // un file da src/assets/shop/ e incollane il path. Es: image: "/assets/…" o un URL https.
  image?: string;
  // Campi specifici protesi
  baseStyle?: BaseStyle;
  wave?: WaveStyle;
  hairColorHex?: string; // colore capello per il disegno
  grayPct?: number; // 0-100
  specs?: Spec[];
}

export const CATEGORIES: Category[] = [
  { key: "toupee", label: "Protesi & Toupee", tagline: "Basi lace, skin, mono e silk top", icon: "Layers" },
  { key: "shampoo", label: "Shampoo", tagline: "Detergenti delicati per protesi e lace", icon: "Droplets" },
  { key: "balsamo", label: "Balsami", tagline: "Idratazione e morbidezza dei capelli", icon: "Waves" },
  { key: "districanti", label: "Districanti", tagline: "Spray leave-in anti-nodo", icon: "Wind" },
  { key: "solventi", label: "Solventi & Remover", tagline: "Rimozione sicura di colla e nastro", icon: "FlaskConical" },
  { key: "adesivi", label: "Adesivi & Nastri", tagline: "Colle e tape a tenuta prolungata", icon: "Link2" },
  { key: "spazzole", label: "Spazzole & Pettini", tagline: "Loop brush e pettini anti-strappo", icon: "Brush" },
  { key: "kit", label: "Kit Completi", tagline: "Tutto l'occorrente in un set", icon: "Package" },
  { key: "accessori", label: "Accessori", tagline: "Sealer, protezioni e cura", icon: "Wrench" },
];

// Colori capello standard usati dai grandi produttori (color ring).
const HAIR = {
  n1: "#0d0d10", // 1 Nero
  n1b: "#17130f", // 1B Nero naturale
  n2: "#2b1a11", // 2 Castano scuro
  n3: "#3a2416", // 3 Castano medio-scuro
  n4: "#4c3220", // 4 Castano
  n5: "#61432b", // 5 Castano medio
  n6: "#79552f", // 6 Castano chiaro
  n7: "#8f6a3c", // 7 Biondo scuro
  gray: "#a9a9ad",
};

const COLOR_OPTS = ["1 Nero", "1B Nero naturale", "2 Castano scuro", "4 Castano", "6 Castano chiaro", "Sale e pepe"];
const LEN_OPTS = ['6"', '8"', '10"'];
const SIZE_OPTS = ['8"x10"', '7"x9"', '6"x8"'];

export const PRODUCTS: Product[] = [
  // ─────────────────────── PROTESI / TOUPEE ───────────────────────
  {
    id: "t01", slug: "lace-front-swiss-pu", name: "Lace Front Swiss + PU", category: "toupee",
    price: 289, compareAt: 349, tone: "brand", icon: "Layers", rating: 4.8, reviews: 214, stock: 14,
    baseStyle: "hybrid", wave: "straight", hairColorHex: HAIR.n1b,
    short: "Fronte in Swiss lace invisibile, retro e perimetro in poliuretano.",
    description: "La costruzione più venduta: attaccatura frontale in Swiss lace ultrasottile per un'attaccatura invisibile, corpo e perimetro in poliuretano sottile per una tenuta salda e una pulizia facilissima. L'equilibrio perfetto tra realismo e durata.",
    bullets: ["Fronte Swiss lace invisibile", "Perimetro PU per la tenuta", "Capelli veri Remy cuticola integra", "Densità media 100-110%"],
    badges: ["Best seller", "Capelli veri"],
    specs: [
      { label: "Base", value: "Swiss lace front + PU 0,08 mm" },
      { label: "Capelli", value: "Umani Remy cuticola integra" },
      { label: "Densità", value: "100-110% (media)" },
      { label: "Onda", value: "Liscio naturale" },
    ],
    variants: [
      { label: "Colore", options: COLOR_OPTS },
      { label: "Lunghezza", options: LEN_OPTS },
      { label: "Misura base", options: SIZE_OPTS },
    ],
  },
  {
    id: "t02", slug: "french-lace-front-comfort", name: "French Lace Front Comfort", category: "toupee",
    price: 269, tone: "cyan", icon: "Layers", rating: 4.7, reviews: 156, stock: 20,
    baseStyle: "lace", wave: "straight", hairColorHex: HAIR.n2,
    short: "French lace resistente e traspirante con attaccatura naturale.",
    description: "French lace leggermente più robusto dello Swiss: ottimo compromesso tra invisibilità dell'attaccatura e durata. Traspirante e confortevole per tutto il giorno, ideale per chi cerca leggerezza senza rinunciare alla resistenza.",
    bullets: ["French lace traspirante", "Attaccatura naturale", "Più resistente dello Swiss", "Nodi frontali sbiancati"],
    specs: [
      { label: "Base", value: "Full French lace" },
      { label: "Capelli", value: "Umani Remy" },
      { label: "Densità", value: "100-120%" },
      { label: "Traspirabilità", value: "Alta" },
    ],
    variants: [{ label: "Colore", options: COLOR_OPTS }, { label: "Lunghezza", options: LEN_OPTS }, { label: "Misura base", options: SIZE_OPTS }],
  },
  {
    id: "t03", slug: "hd-lace-ultrafine-full", name: "HD Lace Ultra-fine Full", category: "toupee",
    price: 349, compareAt: 429, tone: "violet", icon: "Layers", rating: 4.9, reviews: 132, stock: 9,
    baseStyle: "lace", wave: "straight", hairColorHex: HAIR.n1,
    short: "Full HD lace che scompare sulla pelle: massimo realismo dell'attaccatura.",
    description: "La base full HD lace è la più sottile in assoluto: il lace ad alta definizione si fonde con qualsiasi tono di pelle rendendo l'attaccatura letteralmente invisibile anche da vicino. Per chi vuole il risultato più realistico possibile.",
    bullets: ["HD lace ultra-fine", "Attaccatura invisibile da vicino", "Full lace traspirante", "Nodi singoli fatti a mano"],
    badges: ["Top realismo"],
    specs: [
      { label: "Base", value: "Full HD Swiss lace" },
      { label: "Capelli", value: "Umani Remy premium" },
      { label: "Densità", value: "90-110%" },
      { label: "Attaccatura", value: "Irregolare a mano" },
    ],
    variants: [{ label: "Colore", options: COLOR_OPTS }, { label: "Lunghezza", options: LEN_OPTS }, { label: "Misura base", options: SIZE_OPTS }],
  },
  {
    id: "t04", slug: "thin-skin-003-vlooped", name: "Thin Skin 0.03mm V-looped", category: "toupee",
    price: 259, tone: "amber", icon: "Layers", rating: 4.6, reviews: 98, stock: 12,
    baseStyle: "skin", wave: "straight", hairColorHex: HAIR.n1b,
    short: "Pelle ultra-sottile 0,03 mm con capelli V-looped, effetto seconda pelle.",
    description: "La base skin più sottile: 0,03 mm di poliuretano con capelli inseriti in V-loop (senza nodi) che simulano la crescita diretta dalla pelle. Realismo estremo del punto di uscita, ma delicata: pensata per chi cambia spesso la protesi.",
    bullets: ["Thin skin 0,03 mm", "Capelli V-looped senza nodi", "Punto di uscita realistico", "Effetto seconda pelle"],
    badges: ["Ultra-sottile"],
    specs: [
      { label: "Base", value: "Poliuretano 0,03 mm" },
      { label: "Inserimento", value: "V-loop (no nodi)" },
      { label: "Capelli", value: "Umani Remy" },
      { label: "Durata", value: "Breve (3-6 mesi)" },
    ],
    variants: [{ label: "Colore", options: COLOR_OPTS }, { label: "Lunghezza", options: ['6"', '8"'] }, { label: "Misura base", options: SIZE_OPTS }],
  },
  {
    id: "t05", slug: "thin-skin-006-natural", name: "Thin Skin 0.06mm Natural", category: "toupee",
    price: 239, tone: "amber", icon: "Layers", rating: 4.7, reviews: 176, stock: 22,
    baseStyle: "skin", wave: "straight", hairColorHex: HAIR.n2,
    short: "Skin 0,06 mm: il miglior equilibrio tra realismo e durata.",
    description: "Poliuretano da 0,06 mm, lo spessore più popolare: pelle realistica, facile da pulire e con una durata ragionevole. Perfetta per l'uso quotidiano con colla o nastro. La scelta ideale per la maggior parte degli utenti skin.",
    bullets: ["Thin skin 0,06 mm", "Realismo + durata bilanciati", "Facile da pulire", "Colla o nastro"],
    badges: ["Più venduta skin"],
    specs: [
      { label: "Base", value: "Poliuretano 0,06 mm" },
      { label: "Capelli", value: "Umani Remy" },
      { label: "Densità", value: "100-110%" },
      { label: "Durata", value: "Media (6-9 mesi)" },
    ],
    variants: [{ label: "Colore", options: COLOR_OPTS }, { label: "Lunghezza", options: ['6"', '8"'] }, { label: "Misura base", options: SIZE_OPTS }],
  },
  {
    id: "t06", slug: "injected-skin-010", name: "Injected Skin 0.10mm", category: "toupee",
    price: 249, tone: "slate", icon: "Layers", rating: 4.6, reviews: 84, stock: 18,
    baseStyle: "skin", wave: "straight", hairColorHex: HAIR.n4,
    short: "Skin injected 0,10 mm: capelli iniettati con angolo di crescita realistico.",
    description: "Base skin da 0,10 mm con capelli iniettati (injected) che replicano l'angolazione naturale di crescita e permettono di pettinare in ogni direzione. Più spessa e quindi più resistente delle skin sottili.",
    bullets: ["Poliuretano 0,10 mm", "Capelli iniettati multi-direzione", "Angolo di crescita realistico", "Buona durata"],
    specs: [
      { label: "Base", value: "Poliuretano injected 0,10 mm" },
      { label: "Inserimento", value: "Injected" },
      { label: "Capelli", value: "Umani Remy" },
      { label: "Durata", value: "Media-alta" },
    ],
    variants: [{ label: "Colore", options: COLOR_OPTS }, { label: "Lunghezza", options: ['6"', '8"'] }, { label: "Misura base", options: SIZE_OPTS }],
  },
  {
    id: "t07", slug: "super-skin-012-durable", name: "Super Skin 0.12mm Durable", category: "toupee",
    price: 229, tone: "slate", icon: "Layers", rating: 4.5, reviews: 72, stock: 26,
    baseStyle: "skin", wave: "straight", hairColorHex: HAIR.n1b,
    short: "La skin più resistente: 0,12 mm per la massima longevità.",
    description: "Poliuretano da 0,12 mm pensato per durare: la base skin più robusta, ideale per chi vuole longevità e facilità di manutenzione. Ottima per i principianti che imparano ad applicare la protesi.",
    bullets: ["Poliuretano 0,12 mm", "Massima durata skin", "Facile da gestire", "Ideale principianti"],
    badges: ["Più resistente"],
    specs: [
      { label: "Base", value: "Poliuretano 0,12 mm" },
      { label: "Capelli", value: "Umani Remy" },
      { label: "Densità", value: "110-120%" },
      { label: "Durata", value: "Alta (9-12 mesi)" },
    ],
    variants: [{ label: "Colore", options: COLOR_OPTS }, { label: "Lunghezza", options: ['6"', '8"'] }, { label: "Misura base", options: SIZE_OPTS }],
  },
  {
    id: "t08", slug: "mono-durable-poly", name: "Mono Durable + Poly", category: "toupee",
    price: 219, tone: "emerald", icon: "Layers", rating: 4.6, reviews: 121, stock: 24,
    baseStyle: "mono", wave: "straight", hairColorHex: HAIR.n2,
    short: "Mono top resistente con perimetro in poly: durata e movimento.",
    description: "Base monofilamento nella zona superiore per un movimento naturale del capello e una lunga durata, con perimetro in poliuretano per un fissaggio saldo. La costruzione più longeva per l'uso quotidiano intenso.",
    bullets: ["Mono top resistente", "Perimetro poly per la tenuta", "Movimento naturale", "Durata elevata"],
    badges: ["Longeva"],
    specs: [
      { label: "Base", value: "Fine mono + PU perimetro" },
      { label: "Capelli", value: "Umani Remy" },
      { label: "Densità", value: "110-130%" },
      { label: "Durata", value: "Alta" },
    ],
    variants: [{ label: "Colore", options: COLOR_OPTS }, { label: "Lunghezza", options: ['6"', '8"'] }, { label: "Misura base", options: SIZE_OPTS }],
  },
  {
    id: "t09", slug: "silk-top-invisible-knots", name: "Silk Top Invisible Knots", category: "toupee",
    price: 329, tone: "violet", icon: "Layers", rating: 4.8, reviews: 67, stock: 8,
    baseStyle: "silk", wave: "straight", hairColorHex: HAIR.n3,
    short: "Silk top: i capelli sembrano crescere dalla pelle, nodi invisibili.",
    description: "La costruzione silk top nasconde i nodi tra due strati, creando l'illusione che i capelli crescano direttamente da un cuoio capelluto realistico. Il massimo per la zona della riga e del vertice. Molto durevole.",
    bullets: ["Nodi completamente invisibili", "Aspetto cuoio capelluto realistico", "Perfetta per la riga", "Molto durevole"],
    badges: ["Nodi invisibili"],
    specs: [
      { label: "Base", value: "Silk top + lace" },
      { label: "Capelli", value: "Umani Remy" },
      { label: "Densità", value: "100-120%" },
      { label: "Durata", value: "Alta" },
    ],
    variants: [{ label: "Colore", options: COLOR_OPTS }, { label: "Lunghezza", options: LEN_OPTS }, { label: "Misura base", options: SIZE_OPTS }],
  },
  {
    id: "t10", slug: "full-swiss-lace-breathe", name: "Full Swiss Lace Breathe", category: "toupee",
    price: 309, tone: "cyan", icon: "Layers", rating: 4.7, reviews: 54, stock: 10,
    baseStyle: "lace", wave: "straight", hairColorHex: HAIR.n1,
    short: "Full Swiss lace: leggerezza e ventilazione totali per i climi caldi.",
    description: "Costruzione integralmente in Swiss lace per la massima traspirabilità: quasi impercettibile da indossare, ideale nei climi caldi e per chi tiene la protesi tutto il giorno. Delicata, va trattata con cura.",
    bullets: ["Full Swiss lace", "Massima traspirabilità", "Ultra leggera", "Ideale climi caldi"],
    specs: [
      { label: "Base", value: "Full Swiss lace" },
      { label: "Capelli", value: "Umani Remy" },
      { label: "Densità", value: "90-110%" },
      { label: "Traspirabilità", value: "Massima" },
    ],
    variants: [{ label: "Colore", options: COLOR_OPTS }, { label: "Lunghezza", options: LEN_OPTS }, { label: "Misura base", options: SIZE_OPTS }],
  },
  {
    id: "t11", slug: "wave-mediterraneo-lace", name: "Wave Mediterraneo Lace", category: "toupee",
    price: 319, tone: "brand", icon: "Layers", rating: 4.8, reviews: 61, stock: 9,
    baseStyle: "hybrid", wave: "wavy", hairColorHex: HAIR.n2,
    short: "Onda mediterranea pre-impostata su base lace front + poly.",
    description: "Per chi ha i capelli mossi: texture ondulata realistica che mantiene la forma nel tempo, su base lace front con perimetro poly. Look mediterraneo autentico senza bisogno di piastra o styling quotidiano.",
    bullets: ["Onda naturale pre-impostata", "Base lace front + poly", "Mantiene la forma", "Capelli veri"],
    specs: [
      { label: "Base", value: "Lace front + PU" },
      { label: "Onda", value: "Mossa mediterranea" },
      { label: "Capelli", value: "Umani Remy" },
      { label: "Densità", value: "110-120%" },
    ],
    variants: [
      { label: "Colore", options: ["1B Nero naturale", "2 Castano scuro", "4 Castano"] },
      { label: "Onda", options: ["Leggera", "Media"] },
      { label: "Lunghezza", options: ['8"', '10"'] },
    ],
  },
  {
    id: "t12", slug: "curly-afro-mono", name: "Curly Afro Mono", category: "toupee",
    price: 339, tone: "emerald", icon: "Layers", rating: 4.7, reviews: 38, stock: 7,
    baseStyle: "mono", wave: "curly", hairColorHex: HAIR.n1,
    short: "Ricci definiti su base mono resistente, texture afro naturale.",
    description: "Riccio definito e voluminoso su base monofilamento robusta: la scelta per chi ha capelli afro o molto ricci. Texture realistica e duratura, movimento del capello naturale grazie al mono top.",
    bullets: ["Ricci afro definiti", "Base mono resistente", "Volume naturale", "Lunga durata"],
    specs: [
      { label: "Base", value: "Fine mono + PU" },
      { label: "Onda", value: "Riccio afro" },
      { label: "Capelli", value: "Umani Remy" },
      { label: "Densità", value: "120-140%" },
    ],
    variants: [{ label: "Colore", options: ["1 Nero", "1B Nero naturale", "2 Castano scuro"] }, { label: "Lunghezza", options: ['6"', '8"'] }],
  },
  {
    id: "t13", slug: "graystyle-sale-pepe-hd", name: "GrayStyle Sale & Pepe HD", category: "toupee",
    price: 299, tone: "slate", icon: "Layers", rating: 4.7, reviews: 44, stock: 11,
    baseStyle: "lace", wave: "straight", hairColorHex: HAIR.n2, grayPct: 40,
    short: "Percentuali di grigio calibrate a mano su base HD lace front.",
    description: "Protesi con grigio miscelato a mano (20-60%) per un look maturo e credibile, su base HD lace front per un'attaccatura invisibile anche sui toni sale e pepe. Il realismo che serve per un risultato naturale.",
    bullets: ["Grigio 20-60% a scelta", "HD lace front", "Miscela fatta a mano", "Capelli veri"],
    specs: [
      { label: "Base", value: "HD lace front + PU" },
      { label: "Grigio", value: "20-60% (a scelta)" },
      { label: "Capelli", value: "Umani Remy" },
      { label: "Densità", value: "100-110%" },
    ],
    variants: [{ label: "Grigio", options: ["20%", "40%", "60%"] }, { label: "Lunghezza", options: ['6"', '8"'] }],
  },
  {
    id: "t14", slug: "skin-lace-front-hybrid", name: "Skin + Lace Front Hybrid", category: "toupee",
    price: 279, tone: "brand", icon: "Layers", rating: 4.7, reviews: 89, stock: 16,
    baseStyle: "hybrid", wave: "straight", hairColorHex: HAIR.n4,
    short: "Corpo in thin skin con attaccatura in lace: realismo e pulizia.",
    description: "Il meglio dei due mondi: corpo in thin skin 0,08 mm per una pulizia facile e una tenuta salda, con attaccatura frontale in lace per un'attaccatura invisibile. Molto scelta da chi passa dalla lace alla skin.",
    bullets: ["Corpo thin skin 0,08 mm", "Attaccatura in lace invisibile", "Pulizia facile", "Tenuta salda"],
    badges: ["Ibrida"],
    specs: [
      { label: "Base", value: "Thin skin 0,08 mm + lace front" },
      { label: "Capelli", value: "Umani Remy" },
      { label: "Densità", value: "100-110%" },
      { label: "Durata", value: "Media" },
    ],
    variants: [{ label: "Colore", options: COLOR_OPTS }, { label: "Lunghezza", options: ['6"', '8"'] }, { label: "Misura base", options: SIZE_OPTS }],
  },
  {
    id: "t15", slug: "european-remy-premium-lace", name: "European Remy Premium Lace", category: "toupee",
    price: 449, compareAt: 529, tone: "violet", icon: "Layers", rating: 4.9, reviews: 41, stock: 5,
    baseStyle: "lace", wave: "wavy", hairColorHex: HAIR.n5,
    short: "Capelli europei Remy di alta gamma su full French lace.",
    description: "La nostra protesi premium: capelli europei Remy selezionati, più fini e naturali, su base full French lace. Texture, luce e caduta di altissimo livello per chi non vuole compromessi.",
    bullets: ["Capelli europei Remy premium", "Full French lace", "Texture ultra-naturale", "Selezione top di gamma"],
    badges: ["Premium", "Capelli europei"],
    specs: [
      { label: "Base", value: "Full French lace" },
      { label: "Capelli", value: "Europei Remy premium" },
      { label: "Densità", value: "90-110%" },
      { label: "Onda", value: "Leggera onda naturale" },
    ],
    variants: [{ label: "Colore", options: COLOR_OPTS }, { label: "Lunghezza", options: LEN_OPTS }, { label: "Misura base", options: SIZE_OPTS }],
  },
  {
    id: "t16", slug: "stock-express-lace-front", name: "Stock Express Lace Front", category: "toupee",
    price: 179, tone: "cyan", icon: "Layers", rating: 4.4, reviews: 133, stock: 40,
    baseStyle: "hybrid", wave: "straight", hairColorHex: HAIR.n2,
    short: "Pronta consegna: lace front + poly, spedizione in 24/48h.",
    description: "Modello a stock pronto alla spedizione (24/48h) con base lace front e perimetro poly: qualità solida a un prezzo accessibile, senza attese di produzione. Ideale come prima protesi o di scorta.",
    bullets: ["Pronta consegna 24/48h", "Lace front + poly", "Ottimo rapporto qualità-prezzo", "Ideale come scorta"],
    badges: ["Pronta consegna"],
    specs: [
      { label: "Base", value: "Lace front + PU" },
      { label: "Capelli", value: "Umani Remy" },
      { label: "Densità", value: "110%" },
      { label: "Spedizione", value: "24/48h" },
    ],
    variants: [{ label: "Colore", options: ["1B Nero naturale", "2 Castano scuro", "4 Castano"] }, { label: "Lunghezza", options: ['6"', '8"'] }],
  },

  // ─────────────────────── SHAMPOO ───────────────────────
  {
    id: "s1", slug: "shampoo-delicato-lace", name: "Shampoo Delicato Lace-Safe", category: "shampoo",
    price: 24, tone: "cyan", icon: "Droplets", rating: 4.8, reviews: 189, stock: 120,
    short: "Solfati-free, deterge senza intaccare nodi e base.",
    description: "Formula priva di solfati per protesi e lace: pulisce sebo e residui di adesivo senza allentare i nodi né seccare i capelli. pH bilanciato, profumo tenue.",
    bullets: ["Senza solfati", "Sicuro su lace e nodi", "pH bilanciato", "500 ml"], badges: ["Solfati-free"],
  },
  {
    id: "s2", slug: "shampoo-idratante-remy", name: "Shampoo Idratante Remy", category: "shampoo",
    price: 22, tone: "brand", icon: "Droplets", rating: 4.6, reviews: 132, stock: 90,
    short: "Nutre i capelli veri Remy mantenendo lucentezza e morbidezza.",
    description: "Con cheratina e olio di argan, ridona idratazione ai capelli veri che, non ricevendo sebo, tendono a seccarsi. Uso regolare per protesi luminose e morbide.",
    bullets: ["Cheratina + argan", "Anti-secchezza", "Per capelli veri", "500 ml"],
  },

  // ─────────────────────── BALSAMO ───────────────────────
  {
    id: "b1", slug: "balsamo-nutriente-argan", name: "Balsamo Nutriente Argan", category: "balsamo",
    price: 23, tone: "amber", icon: "Waves", rating: 4.7, reviews: 141, stock: 100,
    short: "Ammorbidisce e ripristina la fibra dopo ogni lavaggio.",
    description: "Balsamo ricco all'olio di argan e pantenolo: ripara le lunghezze, riduce l'effetto crespo e facilita la pettinatura senza appesantire né lasciare residui sulla base.",
    bullets: ["Argan + pantenolo", "Anti-crespo", "Non appesantisce", "300 ml"],
  },
  {
    id: "b2", slug: "maschera-riparatrice", name: "Maschera Riparatrice Intensiva", category: "balsamo",
    price: 29, tone: "violet", icon: "Waves", rating: 4.8, reviews: 87, stock: 70,
    short: "Trattamento profondo settimanale per capelli stressati.",
    description: "Con cheratina idrolizzata e burro di karité: ricostruisce la fibra dei capelli sottoposti a styling e agenti esterni. Un utilizzo a settimana per protesi come nuove.",
    bullets: ["Cheratina idrolizzata", "Burro di karité", "Uso settimanale", "200 ml"], badges: ["Intensiva"],
  },

  // ─────────────────────── DISTRICANTI ───────────────────────
  {
    id: "d1", slug: "spray-districante-leave-in", name: "Spray Districante Leave-in", category: "districanti",
    price: 19, tone: "emerald", icon: "Wind", rating: 4.9, reviews: 203, stock: 150,
    short: "Scioglie i nodi all'istante senza strappare i nodi della base.",
    description: "Spray leave-in che lubrifica la fibra e scioglie i nodi con una passata, riducendo la caduta durante la pettinatura. Con protezione termica.",
    bullets: ["Anti-nodo immediato", "Riduce la caduta", "Protezione termica", "200 ml"], badges: ["Top rated"],
  },
  {
    id: "d2", slug: "olio-districante-lucidante", name: "Olio Districante Lucidante", category: "districanti",
    price: 21, tone: "amber", icon: "Wind", rating: 4.6, reviews: 76, stock: 85,
    short: "Poche gocce per districare e donare lucentezza specchio.",
    description: "Olio secco a rapido assorbimento che districa le lunghezze e sigilla le punte donando lucentezza intensa. Ideale sui capelli veri opachi. Non unge la base.",
    bullets: ["Olio secco", "Lucentezza specchio", "Sigilla le punte", "100 ml"],
  },

  // ─────────────────────── SOLVENTI / REMOVER ───────────────────────
  {
    id: "r1", slug: "solvente-remover-citrus", name: "Solvente Remover Citrus", category: "solventi",
    price: 18, tone: "amber", icon: "FlaskConical", rating: 4.8, reviews: 167, stock: 130,
    short: "A base di agrumi, scioglie colla e nastro in pochi secondi.",
    description: "Remover a base di oli di agrumi che dissolve rapidamente adesivi liquidi e residui di tape senza aggredire base skin o lace. Delicato sulla pelle, profumo fresco.",
    bullets: ["Base agrumi", "Scioglie colla e tape", "Delicato su pelle e base", "Spray 118 ml"], badges: ["Best seller"],
  },
  {
    id: "r2", slug: "remover-gel-pro", name: "Remover Gel Professionale", category: "solventi",
    price: 24, tone: "cyan", icon: "FlaskConical", rating: 4.7, reviews: 54, stock: 60,
    short: "Gel che aderisce e agisce anche sugli adesivi più tenaci.",
    description: "Formula in gel che resta dove serve e penetra gli adesivi a lunga tenuta senza colare. Perfetto per basi skin con colla forte. Risciacquo facile.",
    bullets: ["Formula gel no-drip", "Adesivi a lunga tenuta", "Per basi skin", "150 ml"],
  },

  // ─────────────────────── ADESIVI / NASTRI ───────────────────────
  {
    id: "a1", slug: "colla-liquida-waterproof", name: "Colla Liquida Waterproof", category: "adesivi",
    price: 27, tone: "brand", icon: "Link2", rating: 4.7, reviews: 149, stock: 110,
    short: "Tenuta fino a 3 settimane, resistente a sudore e acqua.",
    description: "Adesivo liquido waterproof (2-3 settimane) che regge sudore, doccia e sport. Finitura opaca naturale. Da applicare a strati sottili.",
    bullets: ["Tenuta 2-3 settimane", "Waterproof", "Finitura opaca", "15 ml con pennello"], badges: ["Lunga tenuta"],
    variants: [{ label: "Tenuta", options: ["Soft (1 sett.)", "Strong (2-3 sett.)"] }],
  },
  {
    id: "a2", slug: "nastro-biadesivo-contour", name: "Nastro Biadesivo Contour", category: "adesivi",
    price: 15, tone: "slate", icon: "Link2", rating: 4.6, reviews: 121, stock: 140,
    short: "Strisce sagomate pronte, pulizia rapida e tenuta sicura.",
    description: "Nastro biadesivo pre-tagliato in strisce sagomate per il contorno base: applicazione veloce, tenuta 1-2 settimane e rimozione pulita. 36 strisce.",
    bullets: ["36 strisce sagomate", "Tenuta 1-2 settimane", "Rimozione pulita", "Contour ready"],
    variants: [{ label: "Formato", options: ["Dritte", "Sagomate contour", "Protruder"] }],
  },

  // ─────────────────────── SPAZZOLE / PETTINI ───────────────────────
  {
    id: "p1", slug: "loop-brush-anti-strappo", name: "Loop Brush Anti-strappo", category: "spazzole",
    price: 12, tone: "cyan", icon: "Brush", rating: 4.9, reviews: 178, stock: 200,
    short: "Setole a occhiello: pettina senza agganciare i nodi.",
    description: "Le setole a occhiello (loop) scivolano tra i capelli senza agganciare i nodi della base, riducendo drasticamente la perdita di capelli. Indispensabile.",
    bullets: ["Setole a occhiello", "Non aggancia i nodi", "Riduce la caduta", "Manico ergonomico"], badges: ["Essenziale"],
  },
  {
    id: "p2", slug: "pettine-coda-acciaio", name: "Pettine Coda in Acciaio", category: "spazzole",
    price: 9, tone: "slate", icon: "Brush", rating: 4.5, reviews: 63, stock: 180,
    short: "Denti larghi antistatici per separare e sistemare la riga.",
    description: "Pettine a denti larghi con codino in acciaio per definire la riga e separare le ciocche senza elettricità statica. Delicato su lace e skin.",
    bullets: ["Denti larghi", "Antistatico", "Codino in acciaio", "Delicato su base"],
  },

  // ─────────────────────── KIT ───────────────────────
  {
    id: "k1", slug: "kit-starter-completo", name: "Kit Starter Completo", category: "kit",
    price: 79, compareAt: 104, tone: "brand", icon: "Package", rating: 4.9, reviews: 92, stock: 40,
    short: "Colla, remover, shampoo, balsamo e loop brush in un set.",
    description: "Il set perfetto per iniziare: colla waterproof, solvente remover, shampoo lace-safe, balsamo argan e loop brush. Tutto per applicare e curare la protesi, con il 25% di risparmio.",
    bullets: ["5 prodotti essenziali", "Risparmio 25%", "Guida all'uso inclusa", "Ideale principianti"], badges: ["Risparmi 25%", "Bundle"],
  },
  {
    id: "k2", slug: "kit-manutenzione-mensile", name: "Kit Manutenzione Mensile", category: "kit",
    price: 59, compareAt: 74, tone: "emerald", icon: "Package", rating: 4.8, reviews: 57, stock: 50,
    short: "Shampoo, balsamo, districante e nastri: la scorta mensile.",
    description: "Per mantenere la protesi al top ogni mese: shampoo idratante, balsamo, spray districante e nastri biadesivi. Praticità e risparmio in un set.",
    bullets: ["4 prodotti", "Scorta mensile", "Risparmio 20%", "Uso quotidiano"], badges: ["Bundle"],
  },

  // ─────────────────────── ACCESSORI ───────────────────────
  {
    id: "x1", slug: "scalp-protector-primer", name: "Scalp Protector Primer", category: "accessori",
    price: 16, tone: "violet", icon: "Wrench", rating: 4.6, reviews: 88, stock: 95,
    short: "Barriera protettiva tra pelle e adesivo, migliora la tenuta.",
    description: "Crea una barriera protettiva sul cuoio capelluto: protegge la pelle sensibile dall'adesivo e ne aumenta la durata. Applicare prima della colla.",
    bullets: ["Protegge la pelle", "Aumenta la tenuta", "Per pelli sensibili", "60 ml"],
  },
  {
    id: "x2", slug: "sealer-protettivo-base", name: "Sealer Protettivo Base", category: "accessori",
    price: 20, tone: "cyan", icon: "Wrench", rating: 4.7, reviews: 49, stock: 65,
    short: "Sigilla i nodi della base skin per una durata maggiore.",
    description: "Sigilla nodi e poly della base skin proteggendola dall'olio della pelle e dagli agenti esterni. Prolunga la vita della protesi e mantiene i capelli ancorati.",
    bullets: ["Sigilla nodi e poly", "Prolunga la durata", "Protegge dagli oli", "120 ml"],
  },
  {
    id: "x3", slug: "spazzola-pulizia-base", name: "Spazzola Pulizia Base", category: "accessori",
    price: 8, tone: "slate", icon: "Wrench", rating: 4.5, reviews: 71, stock: 160,
    short: "Setole rigide per rimuovere residui di colla dalla base.",
    description: "Spazzolino a setole rigide per rimuovere i residui secchi di adesivo dalla base skin e dal lace durante la pulizia col remover. Doppia estremità.",
    bullets: ["Setole rigide", "Rimuove residui colla", "Doppia estremità", "Per pulizia base"],
  },
];

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function formatPrice(n: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}

export const TONE_GRADIENT: Record<Product["tone"], string> = {
  brand: "from-[#3b6ee0] to-[#1b3a86]",
  violet: "from-[#7c5cff] to-[#3a1b86]",
  cyan: "from-[#22b6d6] to-[#0e5a86]",
  amber: "from-[#e0a13b] to-[#865a1b]",
  emerald: "from-[#22c07a] to-[#0e8656]",
  slate: "from-[#5a6a86] to-[#2a3450]",
};
