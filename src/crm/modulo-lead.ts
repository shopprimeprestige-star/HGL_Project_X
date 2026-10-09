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
 *  ───────────────────────────────────────────────────────────────────────── */

import type { RisposteModulo } from "@/crm/types";

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
  campo: "urgenza" | "conoscenza" | "zona" | "quando";
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
  {
    campo: "urgenza",
    titolo: "Come vive il problema",
    intestazione: /consider|problema|urgen/,
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
    intestazione: /conosci|hair genius|infoltiment/,
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

/** Che risposta è questo valore? Restituisce campo e opzione, o niente se non
 *  somiglia a nessuna risposta che conosciamo. */
export function riconosciRisposta(
  valore: string,
): { campo: DomandaModulo["campo"]; opzione: OpzioneModulo } | undefined {
  const t = pulisci(valore);
  //  Un valore troppo corto o troppo lungo non è una risposta a scelta: sotto
  //  le tre lettere è una sigla, sopra le duecento è un tema.
  if (t.length < 3 || t.length > 200) return undefined;
  //  1. Le parole esatte del modulo: un confronto esatto non può sbagliare.
  //     ⚠️ Prima del riconoscitore largo, e non dopo: fra due opzioni che si
  //      somigliano deve vincere quella scritta uguale, non la prima che passa.
  for (const d of DOMANDE_MODULO) {
    for (const o of d.opzioni) {
      if (o.testi?.some((x) => pulisci(x) === t)) return { campo: d.campo, opzione: o };
    }
  }
  //  2. La rete, per quando una parola dell'opzione viene riscritta.
  for (const d of DOMANDE_MODULO) {
    for (const o of d.opzioni) if (o.quando.test(t)) return { campo: d.campo, opzione: o };
  }
  return undefined;
}

/** Come si legge una risposta nella scheda. Se l'id non lo conosciamo — un
 *  modulo cambiato, una scheda salvata da una versione più vecchia — si
 *  restituisce l'id così com'è invece di far sparire la voce. */
export function etichettaRisposta(campo: DomandaModulo["campo"], id: string): string {
  const d = DOMANDA_DI.get(campo);
  return d?.opzioni.find((o) => o.id === id)?.nome ?? id;
}

export function tonoRisposta(campo: DomandaModulo["campo"], id: string): "buono" | "medio" | "neutro" {
  const d = DOMANDA_DI.get(campo);
  return d?.opzioni.find((o) => o.id === id)?.tono ?? "neutro";
}

export function titoloDomanda(campo: DomandaModulo["campo"]): string {
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
): RisposteModulo | undefined {
  const out: RisposteModulo = {};
  const risposte: { domanda: string; risposta: string; campo?: string; testo?: string }[] = [];

  riga.forEach((cella, i) => {
    if (presi.has(i)) return;
    const grezzo = String(cella ?? "").trim();
    if (!grezzo) return;
    const trovata = riconosciRisposta(grezzo);
    if (trovata) {
      if (out[trovata.campo]) return;        // la prima vince
      out[trovata.campo] = trovata.opzione.id;
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
    const testa = pulisci(intestazioni[i] ?? "");
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
    const nota = testa ? DOMANDE_MODULO.find((x) => x.intestazione.test(testa)) : undefined;
    if (nota && (nota.aMano || intestazioniAffidabili) && paRisposta(grezzo)) {
      const t = leggibile(grezzo);
      if (t.length >= 3 && t.length <= 160) {
        //  Sulla domanda del quando resta anche il campo dedicato: è quello
        //  che la scheda legge per mostrare «giovedì dopo le 19».
        if (nota.campo === "quando" && !out.quandoTesto && !out.quando) {
          out.quandoTesto = t;
          risposte.push({ domanda: nota.titolo, risposta: t, campo: nota.campo });
          return;
        }
        //  Se la domanda ha già una risposta (l'ha data un'altra colonna, o
        //  l'abbiamo riconosciuta) questa si lascia perdere: la prima vince.
        if (!out[nota.campo] && !risposte.some((r) => r.domanda === nota.titolo))
          risposte.push({ domanda: nota.titolo, risposta: t });
        return;
      }
    }
    //  2. È la risposta a una domanda che non conosciamo. Si tiene solo se
    //     sembra una risposta e se l'intestazione sembra una domanda — e la
    //     domanda si scrive solo quando ci si può credere.
    if (!paRisposta(grezzo)) return;
    const intera = String(intestazioni[i] ?? "").replace(/[_\u00a0]+/g, " ").replace(/\s+/g, " ").trim();
    if (!intestazioniAffidabili || !paDomanda(intera)) return;
    if (risposte.some((r) => r.domanda === intera)) return;   // la prima vince
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
