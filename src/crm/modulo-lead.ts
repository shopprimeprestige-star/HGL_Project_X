/** ─────────────────────────────────────────────────────────────────────────
 *  LE RISPOSTE DEL MODULO, COME VOCI DELLA SCHEDA
 *
 *  DA DOVE ARRIVA
 *  Richiesta del committente: «in base alle domande dentro al lead, ci siano
 *  anche queste info, ma non nelle note, ma proprio come voce a sé stante, in
 *  base alle risposte — così posso tenere traccia bene».
 *
 *  Una lista di Meta (Lead Ads) porta con sé le risposte alle domande del
 *  modulo: quanto la persona considera il problema, se ci conosce già, in che
 *  zona d'Italia sta, quando preferisce essere chiamata. Finivano tutte in
 *  fondo alle note, in fila, separate da un puntino: si leggevano una volta
 *  prima di telefonare e poi sparivano. Non si potevano contare, non si
 *  potevano filtrare, e su ottocento schede non si poteva rispondere a
 *  nessuna delle domande che contano — quanti stanno al Sud, quanti vogliono
 *  essere chiamati di sera, quanti stanno valutando sul serio.
 *
 *  ── ⚠️ SI RICONOSCE LA RISPOSTA, NON LA DOMANDA ──────────────────────────
 *  Qui non ci si fida dell'intestazione, e non è pigrizia: sui file veri di
 *  questo CRM l'intestazione può essere spostata di una colonna (è scritto per
 *  esteso in crm/import-backup.ts, ed è il motivo per cui il telefono si cerca
 *  guardando i valori). Se ci si fidasse, «mattina (9:00–12:00)» finirebbe
 *  sotto «in quale zona d'Italia ti trovi».
 *  Le quattro risposte invece si riconoscono da sole: nessuna zona d'Italia
 *  somiglia a una fascia oraria. Si guarda il VALORE, e la colonna in cui si
 *  trova non conta. L'intestazione serve a una cosa sola — capire che una
 *  risposta scritta a mano («giovedì dopo le 19») è la risposta alla domanda
 *  sul quando, perché quella è l'unica che non si riconosce da sé.
 *
 *  ── ⚠️ E NON SI INVENTA NIENTE ───────────────────────────────────────────
 *  Un valore che non somiglia a nessuna risposta conosciuta NON diventa una
 *  voce: resta fuori. Una voce sbagliata in una scheda è peggio di una voce
 *  mancante — quella mancante si vede, quella sbagliata si crede.
 *
 *  ── ⚠️ LE TRE DOMANDE NUOVE: PROBLEMA, FASTIDIO, GIÀ PROVATO ──────────────
 *  Sulla lista vera di Meta arrivano tre domande in più («che problematica
 *  hai?», «quanto ti infastidisce la calvizie?», «cosa hai già fatto?»). Fino
 *  a ieri non si riconoscevano e finivano nelle note, dove non si contano.
 *  Due trappole, entrambe fermate da una prova:
 *   1. «che problematica hai?» contiene «problema», e con il riconoscitore
 *      largo di «Come vive il problema» le sue risposte finivano sotto la
 *      domanda sbagliata, in silenzio. Le tre nuove stanno IN TESTA all'elenco
 *      e la loro intestazione si controlla per prima.
 *   2. «nulla» è la risposta a due domande (Fastidio: per niente; Già
 *      provato: niente). Da solo non si assegna a nessuna: una risposta sotto
 *      la domanda sbagliata è peggio di una risposta senza domanda. Si assegna
 *      solo quando la colonna è affidabile, o per esclusione nelle note
 *      vecchie (vedi `risposteDaNotaVecchia`).
 *  Fra colonna e valore: se la colonna è affidabile, si cerca prima fra le
 *  opzioni della sua domanda; se però il valore appartiene senza dubbio a
 *  un'altra domanda, vince il valore. Le quattro classiche si comportano come
 *  prima.
 *
 *  ── LEGGERE LE SCHEDE VECCHIE SENZA SCRIVERCI SOPRA ──────────────────────
 *  Le schede già in archivio hanno quelle risposte nella riga «Dal modulo:»
 *  delle note, o in voci salvate con l'intestazione del file come domanda.
 *  `moduloLetto` le rimette insieme al momento della lettura: non modifica la
 *  scheda e nel database non si scrive niente.
 *  ───────────────────────────────────────────────────────────────────────── */

import type { CampoModulo, LeadData, RisposteModulo } from "@/crm/types";

//  Il tipo sta in types.ts (lo usano in tanti); da qui si riesporta per comodità.
export type { CampoModulo };

/** Il testo su cui si fanno i confronti: minuscolo, senza accenti, senza
 *  trattini bassi (Meta li mette al posto degli spazi) e senza doppi spazi. */
export function pulisci(t: string): string {
  return String(t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[_ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface OpzioneModulo {
  id: string;
  /** Come si legge nella scheda: corto, perché sta dentro una pastiglia. */
  nome: string;
  /** Il tono con cui si colora: `buono` = questa persona vale una telefonata
   *  prima delle altre, `medio` = normale, `neutro` = non dice niente sul
   *  valore (la zona, l'ora). */
  tono?: "buono" | "medio" | "neutro";
  /** Come si riconosce la risposta guardandola. */
  quando: RegExp;
  /** ── ⚠️ LE PAROLE ESATTE DEL MODULO ───────────────────────────────────
   *  Il testo dell'opzione così com'è scritto nel modulo di Meta, copiato
   *  dalle liste vere (LEAD - HGL - Ads Accese 01.csv). Si confronta PRIMA
   *  del riconoscitore qui sopra: un confronto esatto non può sbagliare, e
   *  toglie di mezzo ogni dubbio su un'opzione che somiglia a un'altra.
   *  Il riconoscitore resta come rete: il giorno in cui qualcuno riscrive una
   *  parola dell'opzione, la risposta continua a essere capita.
   *  ⚠️ Si confrontano RIPULITI (minuscolo, senza accenti, trattini bassi al
   *   posto degli spazi): nel file Meta scrive «per_me_è_un_mondo_tutto_nuovo.» */
  testi?: string[];
}

export interface DomandaModulo {
  campo: CampoModulo;
  /** Il nome della voce nella scheda. ⚠️ È il NOSTRO, non quello scritto
   *  nell'intestazione del file: vedi la nota in testa. */
  titolo: string;
  /** Riconosce la colonna dall'intestazione. Serve solo per le risposte
   *  scritte a mano, che non si riconoscono dal valore. */
  intestazione: RegExp;
  opzioni: OpzioneModulo[];
  /** La domanda ammette anche una risposta scritta a mano? */
  aMano?: boolean;
}

/*  ⚠️ I RICONOSCITORI SONO LARGHI DI PROPOSITO. I moduli si riscrivono — una
    parola cambiata nell'opzione, una domanda aggiunta — e un riconoscitore che
    pretende la frase esatta smette di funzionare al primo ritocco, in
    silenzio, mentre il file continua a importarsi. Si cercano le due o tre
    parole che portano il significato, non la frase. */
export const DOMANDE_MODULO: DomandaModulo[] = [
  /*  ── LE TRE NUOVE, IN TESTA ──────────────────────────────────────────
      ⚠️ L'ordine conta: è quello della scheda, e `campoDellaColonna` trova
       «problematica» prima che «problema» la rubi alla domanda sbagliata.
      ⚠️ I valori brevi (poco, molto, nulla, niente) sono ANCORATI all'intera
       cella: dentro una frase lunga di una domanda classica non devono
       accendere «Poco» o «Niente». */
  {
    campo: "problema",
    titolo: "Problema",
    //  «problema» da solo è il nostro titolo (le voci già salvate): con altre
    //  parole intorno è «Come vive il problema», che sta più sotto.
    intestazione: /problematic|^problema\??$/,
    opzioni: [
      { id: "androgenetica", nome: "Alopecia androgenetica", tono: "neutro", testi: ["alopecia androgenetica"], quando: /androgenetic/ },
      { id: "areata", nome: "Alopecia areata", tono: "neutro", testi: ["alopecia areata"], quando: /\bareata\b/ },
      { id: "diradamento", nome: "Diradamento", tono: "neutro", quando: /diradament/ },
      { id: "stempiatura", nome: "Stempiatura", tono: "neutro", quando: /stempiat/ },
      //  Aggiunta dopo la misura sui lead veri: 33 schede la avevano e non si leggeva.
      { id: "universale", nome: "Alopecia universale", tono: "neutro", testi: ["alopecia universale"], quando: /universal/ },
    ],
  },
  {
    campo: "fastidio",
    titolo: "Fastidio",
    intestazione: /infastidisc|fastidio/,
    opzioni: [
      { id: "molto", nome: "Molto", tono: "buono", testi: ["molto"], quando: /^molto$/ },
      { id: "abbastanza", nome: "Abbastanza", tono: "buono", testi: ["abbastanza"], quando: /^abbastanza$/ },
      { id: "poco", nome: "Poco", tono: "medio", testi: ["poco"], quando: /^poco$/ },
      //  «nulla» e «niente» sono anche la risposta a «Già provato»: vedi la nota in testa.
      { id: "perNiente", nome: "Per niente", tono: "medio", testi: ["per niente", "nulla"], quando: /^(per niente|nulla|niente)$/ },
    ],
  },
  {
    campo: "giaFatto",
    titolo: "Già provato",
    intestazione: /gia fatto|gia provato|hai fatto|hai provato/,
    opzioni: [
      { id: "niente", nome: "Niente", tono: "medio", testi: ["nulla"], quando: /^(nulla|niente)$/ },
      { id: "trapianto", nome: "Trapianto", tono: "buono", testi: ["trapianto"], quando: /trapiant/ },
      { id: "lozioni", nome: "Lozioni", tono: "buono", testi: ["lozioni"], quando: /lozion/ },
      { id: "farmaci", nome: "Farmaci", tono: "buono", testi: ["farmaci"], quando: /farmac/ },
      //  Aggiunte dopo la misura sui lead veri (27 schede): sono due opzioni vere del
      //  modulo. Tono «medio» e non «buono»: la definizione di lead caldo (piano,
      //  decisione 2) elenca solo trapianto, lozioni e farmaci.
      { id: "tricologia", nome: "Tricologia / PRP / polverine", tono: "medio", testi: ["tricologia / prp / polverine"], quando: /tricologi|\bprp\b|polverin/ },
      { id: "tricopigmentazione", nome: "Tricopigmentazione", tono: "medio", testi: ["trico-pigmentazione (tatuaggio)"], quando: /trico[- ]?pigmentazion|tatuagg/ },
    ],
  },
  {
    campo: "urgenza",
    titolo: "Come vive il problema",
    intestazione: /consider|\bproblema\b|urgen/,
    opzioni: [
      {
        id: "subito",
        nome: "Vuole risolverlo subito",
        tono: "buono",
        quando: /(risolver\w*|provvediment\w*|intervenire)[^.]{0,30}(subito|immediat|al piu presto)|\bsubito\b|urgent|mi condiziona|non ne posso piu/,
      },
      {
        id: "valutando",
        nome: "Lo sta valutando sul serio",
        tono: "buono",
        testi: ["è importante: sto valutando seriamente di prendere provvedimenti nel breve-medio termine."],
        quando: /e importante|valutando seriamente|breve[- ]medio termine|prendere provvedimenti/,
      },
      {
        id: "informativo",
        nome: "Si sta solo informando",
        tono: "medio",
        testi: ["non lo considero ancora un problema, ma voglio informazioni sui nuovi sistemi"],
        quando: /non lo considero ancora|voglio informazioni|solo (per )?informazioni|per curiosit|non e un problema/,
      },
    ],
  },
  {
    campo: "conoscenza",
    titolo: "Ci conosce",
    intestazione: /conosc[ie]|hair genius|infoltiment/,
    opzioni: [
      {
        id: "segue",
        nome: "Ci segue già",
        tono: "buono",
        testi: ["sì: vi seguo da un po'."],
        quando: /vi seguo|vi conosco|si:? vi|gia sentito parlare di voi|vi ho gia/,
      },
      {
        id: "settore",
        nome: "Conosce il settore, non noi",
        tono: "medio",
        quando: /conosco il mondo|conosco l'?ambiente|ho gia (provato|avuto|usato)|altri sistemi|conosco ma non voi/,
      },
      {
        id: "nuovo",
        nome: "Per lui è tutto nuovo",
        tono: "medio",
        testi: ["per me è un mondo tutto nuovo."],
        quando: /mondo tutto nuovo|e un mondo nuovo|non conosco|mai sentito|primo approccio/,
      },
    ],
  },
  {
    campo: "zona",
    titolo: "Zona",
    intestazione: /zona|regione|dove (ti trovi|abiti)|provenienza geografic/,
    opzioni: [
      { id: "nord", nome: "Nord Italia", tono: "neutro", testi: ["nord italia"], quando: /nord italia|\bnord\b|settentrion/ },
      { id: "centro", nome: "Centro Italia", tono: "neutro", quando: /centro italia|\bcentro\b(?! estetic)/ },
      { id: "sud", nome: "Sud e isole", tono: "neutro", testi: ["sud italia e isole"], quando: /sud italia|\bsud\b|isole|meridion/ },
      { id: "estero", nome: "Estero", tono: "neutro", quando: /estero|fuori (dall')?italia|svizzer|altro paese/ },
    ],
  },
  {
    campo: "quando",
    titolo: "Quando chiamarlo",
    //  ⚠️ Questa è l'unica intestazione che serve davvero: la risposta può
    //   essere scritta a mano («giovedì dopo le 19»), e una frase così non si
    //   riconosce dal valore senza rischiare di prendere per un orario la
    //   prima riga di testo che passa.
    intestazione: /quando preferiresti|telefonat|orario|chiamarti|contattart|fascia/,
    aMano: true,
    opzioni: [
      { id: "mattina", nome: "Mattina (9–12)", tono: "neutro", testi: ["mattina (9:00–12:00)"], quando: /mattina|mattino|\b9[:.]00\s*[–-]\s*12/ },
      { id: "pranzo", nome: "Pausa pranzo (12–14)", tono: "neutro", testi: ["pausa pranzo (12:00–14:00)"], quando: /pausa pranzo|ora di pranzo|\b12[:.]00\s*[–-]\s*14/ },
      { id: "pomeriggio", nome: "Pomeriggio (14–18)", tono: "neutro", quando: /pomeriggio|\b14[:.]00\s*[–-]\s*18/ },
      { id: "sera", nome: "Sera (dopo le 18)", tono: "neutro", testi: ["sera (dopo le 18:00)"], quando: /\bsera\b|serata|dopo le 18|\b18[:.]00\b/ },
    ],
  },
];

const DOMANDA_DI = new Map(DOMANDE_MODULO.map((d) => [d.campo, d]));

/** Le tre domande arrivate dopo le quattro classiche. Le classiche si
 *  comportano come sono sempre state: le regole nuove scattano solo se c'entra
 *  una di queste. */
const CAMPI_NUOVI = new Set<CampoModulo>(["problema", "fastidio", "giaFatto"]);

/** Di quale domanda è questa colonna? Si guarda solo l'intestazione, quindi
 *  vale solo se chi legge il file ha verificato che le intestazioni combaciano
 *  con i dati. */
export function campoDellaColonna(h: string): CampoModulo | undefined {
  const t = pulisci(h);
  if (!t) return undefined;
  return DOMANDE_MODULO.find((d) => d.intestazione.test(t))?.campo;
}

/** L'intestazione come si legge da una persona: Meta scrive «cosa_hai_giá_fatto?»
 *  con i trattini bassi e una «á» al posto della «à». Il punto interrogativo resta. */
export function intestazioneLeggibile(h: string): string {
  return String(h ?? "")
    .normalize("NFC")                     // una «á» scomposta (a + accento) è una sola lettera
    .replace(/[_\u00a0]+/g, " ")
    .replace(/á/g, "à")
    .replace(/Á/g, "À")
    .replace(/\s+/g, " ")
    .trim();
}

/** Che risposta è questo valore? Restituisce campo e opzione, o niente se non
 *  somiglia a nessuna risposta che conosciamo.
 *  Con `campo` si cerca solo fra le opzioni di quella domanda. Senza, se il
 *  valore combacia con due domande diverse e una delle due è nuova («nulla»),
 *  non si assegna a nessuna: fra le classiche resta «vince la prima». */
export function riconosciRisposta(
  valore: string,
  campo?: CampoModulo,
): { campo: CampoModulo; opzione: OpzioneModulo } | undefined {
  const t = pulisci(valore);
  //  Un valore troppo corto o troppo lungo non è una risposta a scelta: sotto
  //  le tre lettere è una sigla, sopra le duecento è un tema.
  if (t.length < 3 || t.length > 200) return undefined;
  const domande = campo ? DOMANDE_MODULO.filter((d) => d.campo === campo) : DOMANDE_MODULO;
  const combacia = (vale: (o: OpzioneModulo) => boolean) => {
    const out: { campo: CampoModulo; opzione: OpzioneModulo }[] = [];
    for (const d of domande) for (const o of d.opzioni) if (vale(o)) out.push({ campo: d.campo, opzione: o });
    return out;
  };
  //  1. Le parole esatte del modulo: un confronto esatto non può sbagliare.
  //     ⚠️ Prima del riconoscitore largo, e non dopo: fra due opzioni che si
  //      somigliano deve vincere quella scritta uguale, non la prima che passa.
  //  2. La rete, per quando una parola dell'opzione viene riscritta.
  for (const vale of [
    (o: OpzioneModulo) => !!o.testi?.some((x) => pulisci(x) === t),
    (o: OpzioneModulo) => o.quando.test(t),
  ]) {
    const trovate = combacia(vale);
    if (!trovate.length) continue;
    if (!campo) {
      //  ⚠️ Se fra quelle che combaciano c'è una classica, vince la classica:
      //   «Sì, ho già provato farmaci» è ancora «Conosce il settore» e «Mi
      //   condiziona, ho un diradamento» è ancora «subito», come prima delle
      //   tre domande nuove. Si lascia il valore senza domanda SOLO se
      //   combaciano due domande nuove (il caso «nulla»).
      const classica = trovate.find((x) => !CAMPI_NUOVI.has(x.campo));
      if (classica) return classica;
      if (new Set(trovate.map((x) => x.campo)).size > 1) return undefined;
    }
    return trovate[0];
  }
  return undefined;
}

/** Come si legge una risposta nella scheda. Se l'id non lo conosciamo — un
 *  modulo cambiato, una scheda salvata da una versione più vecchia — si
 *  restituisce l'id così com'è invece di far sparire la voce. */
export function etichettaRisposta(campo: CampoModulo, id: string): string {
  const d = DOMANDA_DI.get(campo);
  return d?.opzioni.find((o) => o.id === id)?.nome ?? id;
}

export function tonoRisposta(campo: CampoModulo, id: string): "buono" | "medio" | "neutro" {
  const d = DOMANDA_DI.get(campo);
  return d?.opzioni.find((o) => o.id === id)?.tono ?? "neutro";
}

export function titoloDomanda(campo: CampoModulo): string {
  return DOMANDA_DI.get(campo)?.titolo ?? campo;
}

/** Il testo di una risposta scritta a mano, ripulito per essere letto da una
 *  persona: Meta scrive con i trattini bassi al posto degli spazi. */
function leggibile(t: string): string {
  const s = String(t ?? "").replace(/[_ ]+/g, " ").replace(/\s+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

/*  ═══ ⚠️ TUTTE LE RISPOSTE, NON SOLO LE QUATTRO CHE CONOSCIAMO ═══════════
    Richiesta del committente: «voglio che sulla scheda lead ci siano TUTTE le
    risposte che danno nel questionario», per poi contarci sopra il tasso di
    conversione.
    Le quattro domande qui sopra le riconosciamo dal valore e hanno un nome
    nostro. Tutte le altre — ogni modulo ne ha di diverse, e cambiano a ogni
    campagna — non si possono prevedere: la loro domanda si può leggere solo
    dall'intestazione della colonna.

    ⚠️ E L'INTESTAZIONE NON SEMPRE SI PUÒ CREDERE. Sui file veri di questo CRM
     può essere spostata di una colonna (vedi crm/import-backup.ts): scrivere
     «in quale zona d'Italia: mattina (9:00-12:00)» sarebbe una bugia stampata
     dentro una scheda, e le bugie stampate si credono. Quindi la domanda si
     scrive SOLO quando chi legge il file ha potuto verificare che le
     intestazioni combaciano con i dati; altrimenti la risposta si tiene lo
     stesso, senza domanda, e la scheda la mostra come «altra risposta».  */

/** Sembra una risposta a una domanda, o è un pezzo di macchina?
 *  Identificativi, date, sì/veri/falsi, numeri puri e nomi di campagne non
 *  dicono niente a nessuno e riempirebbero la scheda di rumore. */
export function paRisposta(valore: string): boolean {
  const t = String(valore ?? "").trim();
  if (!t || t.length < 3 || t.length > 200) return false;
  if (/^\w{1,3}:/.test(t)) return false;                 // l: ag: as: c: f: p:
  if (/^(true|false)$/i.test(t)) return false;
  if (/\d{4}-\d{2}-\d{2}/.test(t)) return false;         // date ISO
  if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(t)) return false; // «Modulo senza titolo 30/11/24»
  if (/^[\d\s+()-]+$/.test(t)) return false;             // numeri e telefoni
  if (/@/.test(t)) return false;                          // email
  if (/[|€]/.test(t)) return false;                       // nomi di campagne e inserzioni
  return true;
}

/** L'intestazione sembra una domanda del questionario? Le domande di Meta
 *  finiscono col punto interrogativo; quando manca, si accetta comunque una
 *  frase lunga — una colonna che si chiama «note» o «id» no. */
export function paDomanda(intestazione: string): boolean {
  const t = pulisci(intestazione);
  if (!t) return false;
  if (t.includes("?")) return true;
  return t.split(" ").length >= 3;
}

/** La domanda, accorciata per stare in una riga senza perdere il senso.
 *  ⚠️ Si accorcia solo per MOSTRARLA: si raggruppa sempre sul testo intero,
 *   altrimenti due domande lunghe che iniziano uguali diventerebbero una. */
export function domandaCorta(domanda: string, max = 48): string {
  const t = String(domanda ?? "").replace(/[_\u00a0]+/g, " ").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const tagliata = t.slice(0, max);
  const spazio = tagliata.lastIndexOf(" ");
  return `${spazio > max / 2 ? tagliata.slice(0, spazio) : tagliata}…`;
}

/** ── DA UNA RIGA DEL FILE ALLE VOCI DELLA SCHEDA ───────────────────────────
 *  `intestazioni` e `riga` sono già divise in celle; `presi` sono gli indici
 *  delle colonne che qualcun altro ha già rivendicato (telefono, email, nome…)
 *  e che qui non si guardano nemmeno.
 *
 *  ⚠️ LA PRIMA RISPOSTA VINCE. Se due colonne dicono la stessa cosa — capita
 *   con i file rimessi insieme a mano, dove una domanda compare due volte —
 *   si tiene la prima e la seconda si ignora, invece di sovrascrivere: la
 *   prima è quella che la persona ha dato per prima. */
export function leggiRisposte(
  intestazioni: string[],
  riga: string[],
  presi: Set<number> = new Set(),
  /** Le intestazioni combaciano con i dati? Lo sa chi legge il file (vedi
   *  `intestazioniAffidabili` in crm/import-backup). Solo se è vero si può
   *  scrivere la domanda accanto a una risposta che non conosciamo. */
  intestazioniAffidabili = false,
  /** Se c'è, ci si scrivono gli indici delle colonne finite nelle risposte:
   *  chi legge il file sa così cosa resta fuori (i «Dati originali»). Una
   *  risposta scartata perché la domanda aveva già la sua non conta. */
  usate?: Set<number>,
): RisposteModulo | undefined {
  const out: RisposteModulo = {};
  const risposte: { domanda: string; risposta: string; campo?: string; testo?: string }[] = [];

  riga.forEach((cella, i) => {
    if (presi.has(i)) return;
    const grezzo = String(cella ?? "").trim();
    if (!grezzo) return;
    const testa = pulisci(intestazioni[i] ?? "");
    const colonna = testa ? campoDellaColonna(testa) : undefined;
    //  ⚠️ CHI COMANDA FRA COLONNA E VALORE. Se la colonna è affidabile ed è di
    //   una domanda nuova, si cerca prima fra le opzioni di quella domanda: è
    //   così che «nulla» trova casa. Se però il valore appartiene senza dubbio
    //   a un'altra domanda («alopecia androgenetica» sotto «Fastidio»), vince
    //   il valore. Sulle classiche non cambia niente: si guarda il valore.
    const colonnaNuova = intestazioniAffidabili && colonna && CAMPI_NUOVI.has(colonna) ? colonna : undefined;
    let trovata = (colonnaNuova && riconosciRisposta(grezzo, colonnaNuova)) || riconosciRisposta(grezzo);
    //  ⚠️ «Abbastanza» è anche una risposta a «Conosci Hair Genius Labs…?»: sotto
    //   una colonna classica affidabile, un Fastidio o un Già provato letto dal
    //   solo valore NON vince. La risposta resta alla sua domanda (strada 1,
    //   qui sotto). Il valore vince solo sul Problema: è l'errore nascosto di
    //   «che problematica hai?» finita sotto «Come vive il problema».
    const colonnaClassica = intestazioniAffidabili && colonna && !CAMPI_NUOVI.has(colonna);
    if (trovata && colonnaClassica && (trovata.campo === "fastidio" || trovata.campo === "giaFatto")) trovata = undefined;
    if (trovata) {
      if (out[trovata.campo]) return;        // la prima vince
      out[trovata.campo] = trovata.opzione.id;
      usate?.add(i);
      risposte.push({
        domanda: titoloDomanda(trovata.campo),
        risposta: trovata.opzione.nome,
        campo: trovata.campo,
        //  Le parole sue per intero: `risposta` è il nome corto che mettiamo
        //  noi, questo è quello che ha scelto.
        testo: leggibile(grezzo),
      });
      return;
    }
    //  Nessuna opzione conosciuta. Tre strade, in quest'ordine.
    /*  1. LA COLONNA È DI UNA DOMANDA CHE CONOSCIAMO, ma l'opzione no.
        ⚠️ QUESTA RIGA TIENE INSIEME I CONTI. I moduli si riscrivono: basta
         un'opzione nuova («mi pesa molto da anni e non so da dove iniziare»)
         perché quella risposta non venga riconosciuta. Senza questo pezzo
         finiva nel sacco delle domande sconosciute, con l'intestazione come
         titolo — e nei KPI la STESSA domanda compariva due volte, una con il
         nostro nome e una con quello del file, ciascuna con metà dei lead.
         Due tabelle che parlano della stessa cosa e nessuna delle due dice il
         vero: il modo più rapido per far smettere di credere alla pagina.
         Adesso la colonna comanda: qualunque cosa ci sia scritto è una
         risposta A QUELLA domanda. Quello che sappiamo leggere prende il nome
         nostro, il resto si mostra com'è — ma sotto lo stesso titolo, quindi
         nello stesso conto.
        ⚠️ Serve che l'intestazione sia credibile, altrimenti su un file con le
         colonne spostate finirebbe un nome di persona dentro «Zona». L'unica
         eccezione è la domanda sul quando, che ammette una risposta scritta a
         mano e vale anche senza quella verifica: era già così. */
    const nota = colonna ? DOMANDA_DI.get(colonna) : undefined;
    if (nota && (nota.aMano || intestazioniAffidabili) && paRisposta(grezzo)) {
      const t = leggibile(grezzo);
      if (t.length >= 3 && t.length <= 160) {
        //  Sulla domanda del quando resta anche il campo dedicato: è quello
        //  che la scheda legge per mostrare «giovedì dopo le 19».
        if (nota.campo === "quando" && !out.quandoTesto && !out.quando) {
          out.quandoTesto = t;
          usate?.add(i);
          risposte.push({ domanda: nota.titolo, risposta: t, campo: nota.campo });
          return;
        }
        //  Se la domanda ha già una risposta (l'ha data un'altra colonna, o
        //  l'abbiamo riconosciuta) questa si lascia perdere: la prima vince.
        if (!out[nota.campo] && !risposte.some((r) => r.domanda === nota.titolo)) {
          usate?.add(i);
          risposte.push({ domanda: nota.titolo, risposta: t });
        }
        return;
      }
    }
    //  2. È la risposta a una domanda che non conosciamo. Si tiene solo se
    //     sembra una risposta e se l'intestazione sembra una domanda — e la
    //     domanda si scrive solo quando ci si può credere.
    if (!paRisposta(grezzo)) return;
    const intera = intestazioneLeggibile(intestazioni[i] ?? "");
    if (!intestazioniAffidabili || !paDomanda(intera)) return;
    if (risposte.some((r) => r.domanda === intera)) return;   // la prima vince
    usate?.add(i);
    risposte.push({ domanda: intera, risposta: leggibile(grezzo) });
  });

  if (risposte.length) out.risposte = risposte;
  return Object.keys(out).length ? out : undefined;
}

export interface VoceModulo {
  campo: string;
  titolo: string;
  valore: string;
  tono: "buono" | "medio" | "neutro";
  /** La frase per intero, quando `valore` è una nostra abbreviazione. */
  testo?: string;
}

/** Le voci da mostrare nella scheda, nell'ordine in cui si leggono.
 *  Una sola funzione per tutte le schermate: il giorno in cui si aggiunge una
 *  domanda, compare dappertutto insieme. */
export function vociModulo(
  m: RisposteModulo | undefined,
): VoceModulo[] {
  if (!m) return [];
  const out: VoceModulo[] = [];
  /** La frase per intero, quando c'è: si mostra come suggerimento. */
  const testoDi = (campo: string) => (m.risposte ?? []).find((r) => r.campo === campo)?.testo;
  for (const d of DOMANDE_MODULO) {
    const id = m[d.campo];
    if (id) {
      out.push({
        campo: d.campo,
        titolo: d.titolo,
        valore: etichettaRisposta(d.campo, id),
        tono: tonoRisposta(d.campo, id),
        testo: testoDi(d.campo),
      });
    } else if (d.campo === "quando" && m.quandoTesto) {
      //  Scritto a mano: vale quanto una fascia scelta, e va letto uguale.
      out.push({ campo: d.campo, titolo: d.titolo, valore: m.quandoTesto, tono: "neutro" });
    }
  }
  /*  ⚠️ E POI TUTTE LE ALTRE. Richiesta del committente: «sulla scheda lead ci
      siano TUTTE le risposte che danno nel questionario». Le domande che non
      conosciamo vengono dopo le quattro di casa — quelle hanno un nome scelto
      e un significato che sappiamo leggere — ma ci sono tutte, con la loro
      domanda davanti. Niente tono: su una risposta che non sappiamo
      interpretare, un colore sarebbe un giudizio inventato. */
  for (const r of m.risposte ?? []) {
    if (r.campo) continue;                                   // già scritta qui sopra
    if (out.some((v) => v.titolo === r.domanda)) continue;
    out.push({
      campo: `altra:${r.domanda}`,
      titolo: domandaCorta(r.domanda),
      valore: r.risposta,
      tono: "neutro",
      //  Qui `risposta` È già la frase per intero: il suggerimento serve solo
      //  quando la domanda è stata accorciata per stare nella riga.
      testo: r.domanda.length > domandaCorta(r.domanda).length ? r.domanda : undefined,
    });
  }
  return out;
}

/** C'è qualcosa da mostrare? */
export const haModulo = (m: RisposteModulo | undefined): boolean => vociModulo(m).length > 0;

/** Il riassunto per una riga: le prime `max` voci, nell'ordine Problema,
 *  Fastidio, Già provato e poi le altre, unite da « · ». Vuoto se non c'è
 *  niente: chi lo mostra decide cosa scrivere al suo posto. */
export function riassuntoModulo(m?: RisposteModulo, max = 2): string {
  return vociModulo(m)
    .slice(0, max)
    .map((v) => `${v.titolo}: ${v.valore}`)
    .join(" · ");
}

/** La domanda classica a cui appartiene un testo, per titolo («Ci conosce») o
 *  per intestazione del file («conosci hair genius labs…?»). */
function campoClassico(domanda: string): CampoModulo | undefined {
  const t = pulisci(domanda);
  const c = DOMANDE_MODULO.find((d) => pulisci(d.titolo) === t)?.campo ?? campoDellaColonna(domanda);
  return c && !CAMPI_NUOVI.has(c) ? c : undefined;
}

type VoceSalvata = NonNullable<RisposteModulo["risposte"]>[number];

/** ── LA RIGA «DAL MODULO:» DELLE NOTE VECCHIE ──────────────────────────────
 *  Prima di oggi le tre domande nuove non si riconoscevano e finivano nelle
 *  note come «Dal modulo: alopecia androgenetica · abbastanza · nulla».
 *  Si legge SOLO dal valore: le note non portano la domanda, e scriverla a
 *  indovinare sarebbe stampare una bugia. Vince la prima risposta di ogni
 *  domanda.
 *  ⚠️ «nulla» da solo resta ambiguo (Fastidio o Già provato) e non si mostra.
 *   Per esclusione, però: in una riga ogni domanda ha una risposta sola, quindi
 *   se un altro valore ha già dato il Fastidio, «nulla» può essere solo Già
 *   provato. Senza quell'appiglio non si indovina. */
export function risposteDaNotaVecchia(note?: string): RisposteModulo | undefined {
  const riga = String(note ?? "")
    .split(/\r?\n/)
    .find((r) => /^\s*Dal modulo:/i.test(r));
  if (!riga) return undefined;
  const parti = riga
    .replace(/^\s*Dal modulo:/i, "")
    .split(" · ")
    .map((x) => x.trim())
    .filter(Boolean);
  const out: RisposteModulo = {};
  const risposte: VoceSalvata[] = [];
  const rimaste: string[] = [];
  const aggiungi = (campo: CampoModulo, id: string, nome: string, parte: string) => {
    out[campo] = id;
    risposte.push({ domanda: titoloDomanda(campo), risposta: nome, campo, testo: leggibile(parte) });
  };
  for (const parte of parti) {
    const t = riconosciRisposta(parte);
    if (!t) {
      rimaste.push(parte);
      continue;
    }
    if (out[t.campo]) continue;            // la prima vince
    aggiungi(t.campo, t.opzione.id, t.opzione.nome, parte);
  }
  //  ⚠️ «abbastanza» o «poco» da soli non sono un Fastidio: nel modulo classico
  //   sono le risposte a «Conosci Hair Genius Labs…?» (misura sui lead veri: 88
  //   schede). Il Fastidio vale solo se la stessa riga ha anche un Problema o un
  //   Già provato, cioè se la riga è del modulo che ha quelle domande. È la
  //   stessa regola per esclusione di «nulla», che qui sotto ne dipende.
  if (out.fastidio && !out.problema && !out.giaFatto) {
    delete out.fastidio;
    const i = risposte.findIndex((r) => r.campo === "fastidio");
    if (i >= 0) risposte.splice(i, 1);
  }
  //  Il secondo passaggio, per esclusione.
  if (out.fastidio && !out.giaFatto) {
    for (const parte of rimaste) {
      const t = riconosciRisposta(parte, "giaFatto");
      if (t?.opzione.id === "niente") {
        aggiungi("giaFatto", t.opzione.id, t.opzione.nome, parte);
        break;
      }
    }
  }
  if (risposte.length) out.risposte = risposte;
  return Object.keys(out).length ? out : undefined;
}

/** ── LE RISPOSTE DI UNA SCHEDA, COME SI LEGGONO OGGI ───────────────────────
 *  Un punto solo per la pagina, la scheda, i filtri e i KPI. Mette insieme tre
 *  cose, e una domanda non compare mai due volte:
 *   1. le risposte salvate nella scheda (`modulo`): vincono sempre;
 *   2. le voci vecchie, salvate con l'intestazione del file come domanda
 *      («quanto ti infastidisce la calvizie?») o con la domanda sbagliata
 *      («Come vive il problema» sopra «Alopecia androgenetica»): si riportano
 *      sotto la domanda nostra;
 *   3. la riga «Dal modulo:» delle note, per le domande che ancora mancano.
 *  ⚠️ SOLO LETTURA: non modifica la scheda (che può essere congelata) e non
 *   scrive niente nel database. Si costruisce sempre un oggetto nuovo. */
export function moduloLetto(d?: Partial<LeadData> | null): RisposteModulo | undefined {
  const salvato = d?.modulo;
  const { risposte: voceSalvate, ...campi } = salvato ?? {};
  const out: RisposteModulo = { ...campi };
  const risposte: VoceSalvata[] = [];
  const haVoce = (titolo: string) => risposte.some((r) => r.domanda === titolo);

  //  1 e 2. Le voci salvate, una per una.
  for (const r of voceSalvate ?? []) {
    if (!r || typeof r !== "object") continue;
    if (r.campo) {
      risposte.push({ ...r });
      continue;
    }
    const colonna = campoDellaColonna(String(r.domanda ?? ""));
    const colonnaNuova = colonna && CAMPI_NUOVI.has(colonna) ? colonna : undefined;
    //  Come in `leggiRisposte`: la domanda nuova cerca fra le sue opzioni, ma
    //  se il valore è senza dubbio di un'altra, vince il valore.
    const t = (colonnaNuova && riconosciRisposta(r.risposta, colonnaNuova)) || riconosciRisposta(r.risposta);
    //  ⚠️ Una voce salvata sotto una domanda classica («Ci conosce», «Zona»…, per
    //   titolo o per intestazione) resta com'è: «Abbastanza» sotto «Ci conosce»
    //   non è un Fastidio. Si sposta solo un Problema: è l'errore nascosto di
    //   «che problematica hai?» finita sotto «Come vive il problema».
    if (campoClassico(String(r.domanda ?? "")) && t?.campo !== "problema") {
      risposte.push({ ...r });
      continue;
    }
    //  Si riportano solo le tre domande nuove: una voce che ha già una
    //  classica per valore non si tocca, i suoi conti restano come oggi.
    if (t && CAMPI_NUOVI.has(t.campo)) {
      //  La domanda ha già la sua risposta: questa voce sarebbe la stessa due volte.
      if (out[t.campo]) continue;
      out[t.campo] = t.opzione.id;
      risposte.push({
        domanda: titoloDomanda(t.campo),
        risposta: t.opzione.nome,
        campo: t.campo,
        testo: leggibile(r.risposta),
      });
      continue;
    }
    if (colonnaNuova) {
      //  Una risposta scritta a mano a una domanda nuova: sotto il suo titolo.
      const titolo = titoloDomanda(colonnaNuova);
      if (!out[colonnaNuova] && !haVoce(titolo)) risposte.push({ domanda: titolo, risposta: r.risposta });
      continue;
    }
    risposte.push({ ...r });
  }

  //  3. Le note vecchie, per quello che manca.
  const nota = risposteDaNotaVecchia(d?.note);
  if (nota) {
    for (const dom of DOMANDE_MODULO) {
      const id = nota[dom.campo];
      if (!id || out[dom.campo] || haVoce(dom.titolo)) continue;
      out[dom.campo] = id;
      const voce = (nota.risposte ?? []).find((r) => r.campo === dom.campo);
      if (voce) risposte.push({ ...voce });
    }
  }

  if (risposte.length) out.risposte = risposte;
  return Object.keys(out).length ? out : undefined;
}
