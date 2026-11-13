/** ── FATTURE DALLA CHAT · L'ADATTATORE AL MOTORE (valuta-chat.ts) ───────────
 *  Commessa 2026-11-13-fatture-dalla-chat (PIANO §0.1, §2, T3). Non è un secondo
 *  motore fatture: costruisce, da una `RigaChat` + la scheda scelta al passo 1,
 *  un `GruppoRicomposto`+`FileLotto[]` SINTETICI con 3 ruoli fissi (indirizzo
 *  dalla chat, tessera dalla chat, pagamento dallo screenshot) e li passa, SENZA
 *  TOCCARLI, a `valutaRiga`/`righePerDoppioni` di `bulk/valuta.ts`. Da lì in poi
 *  regole di riga, doppioni, abbinamento, numerazione e XML sono la stessa
 *  bulk — non si riprovano qui.
 *
 *  ── ⚠️ NOME E COGNOME VENGONO SEMPRE DALLA SCHEDA, MAI DALLA FOTO ─────────
 *  `campiEffettivi()` (bulk/valuta.ts) scrive `CampiRiga.nome`/`.cognome` dalla
 *  `LetturaTessera` del gruppo: se quella lettura fosse quella che l'AI legge
 *  sulla foto, la tessera di un familiare che scrive dallo stesso numero del
 *  cliente scelto (il caso concreto del revisore: la chat del marito con la
 *  foto della tessera della moglie) produrrebbe una fattura intestata a un'altra
 *  persona con il CF di un'altra ancora — un errore fiscale, non un'imprecisione
 *  di anteprima (revisione v1→v2, PIANO §0.1 punto 1, §5 rischio «Fattura
 *  intestata al nome sbagliato»).
 *  Per questo `rigaSinteticaDa` FORZA `nome = scheda.nome`, `cognome =
 *  scheda.cognome` nella `LetturaTessera` sintetica, SEMPRE — anche se in chat
 *  non si è trovata nessuna tessera (nessun CF), anche se quella trovata è di
 *  un familiare: non è condizionato al fatto che un CF sia stato scelto (nota
 *  del revisore sul piano v2, per togliere ogni ambiguità anche nel codice, non
 *  solo nel testo del piano). Il nome/cognome letti dall'AI sulla foto (T2,
 *  `sceglici`) restano un criterio INTERNO a quella funzione — per scegliere fra
 *  più tessere nella stessa chat, se serve — e non attraversano mai questo file:
 *  l'unico contributo che arriva da T2 è `codiceFiscale`/`cfLetto`/`incerti`.
 *  Conseguenza automatica, zero codice nuovo: con `campi.cognome` sempre quello
 *  della scheda, il controllo già esistente `combaciaConNome`/`cf_non_combacia`
 *  di `esaminaRiga` (bulk, non toccata) torna a fare da rete vera contro la
 *  tessera di un familiare → «Da controllare» (PIANO §0.1 punto 1, confermato
 *  dal revisore leggendo `combaciaConNome`/`codiceCognome`/`codiceNome`).
 *
 *  ── ⚠️ UN SOLO MOTIVO QUANDO MANCA IL BONIFICO ────────────────────────────
 *  `gruppo.incompleta` resta SEMPRE `false` (mai la via della bulk: altrimenti
 *  `esaminaRiga` si fermerebbe al primo motivo e nasconderebbe gli asterischi di
 *  CF/indirizzo prima ancora di chiedere il bonifico, PIANO §0.1, §5). Finché
 *  `rigaChat.pagamento?.lettura` non c'è, `esaminaRiga` produce comunque DA SOLA
 *  `importo_mancante`/`modo_mancante`/`data_mancante` (tutti `blocca`, veri ma
 *  ridondanti con «manca il pagamento»): si TOLGONO per CODICE, si aggiunge il
 *  solo motivo `chat_manca_pagamento` (`blocca`+`strutturale`) e si richiama
 *  `statoDi` (bulk/regole-riga.ts, non toccata) con l'elenco risultante. CF,
 *  indirizzo e ogni altro motivo indipendente (es. `cf_non_combacia`,
 *  `indirizzo_mancante`) restano visibili nello stesso elenco: non è la via di
 *  `gruppo.incompleta` (che butterebbe via tutto), è un filtro mirato ai soli
 *  tre codici ridondanti con il pagamento mancante (PIANO §0.1 punto 3).
 *
 *  ── IL CONFRONTO IMPORTO-BONIFICO / IMPORTO-SCHEDA ────────────────────────
 *  Quando il pagamento È stato letto, si confronta con l'importo già registrato
 *  in scheda (`SchedaChat.importoScheda`, passato da chi chiama: è un fatto che
 *  SOLO questa modalità conosce, per questo non sta in `bulk/regole-riga.ts`):
 *  se diversi, un motivo `conferma` (non bloccante, SPEC §5).
 *
 *  ── DOPPIONI FRA LOTTI DI SPECIE DIVERSA (PIANO §0, decisione dell'architetto) ──
 *  Questo file non sceglie da sé cosa va in `ctx.impronteAltriLotti`: lo decide
 *  chi costruisce il `ContestoValutazione` (T5/T6). La semplificazione del piano
 *  — i doppioni fra pagamenti si calcolano SOLO fra lotti «dalla chat» aperti,
 *  non leggendo anche i lotti bulk aperti contemporaneamente (stessa scelta già
 *  fatta dalla bulk per sé stessa) — si traduce per chi chiama in: passare lì
 *  solo le impronte degli ALTRI lotti «dalla chat» aperti, mai quelle della bulk;
 *  di default (nessun altro lotto aperto) quella lista è `[]`. Qui si usa tale
 *  e quale (`ctx.impronteAltriLotti`, generico, bulk/tipi.ts non toccato). */
import { scriviEuro } from "../../euro";
import type { RigaPerDoppioni } from "../bulk/doppioni-e-schede";
import { statoDi } from "../bulk/regole-riga";
import { righePerDoppioni, valutaRiga } from "../bulk/valuta";
import type {
  ContestoValutazione,
  DecisioniRiga,
  FileLotto,
  GruppoRicomposto,
  IngressoRiga,
  Motivo,
  RigaValutata,
  SchedaPerAbbinamento,
} from "../bulk/tipi";
import type { RigaChat } from "./tipi";

/** La scheda scelta al passo 1 (SPEC §5), con in più il pagamento già noto in
 *  scheda — SOLO per il confronto importo-bonifico/importo-scheda di questo
 *  adattatore (PIANO §0.1 punto 3): `bulk/tipi.ts` non si tocca, resta un tipo
 *  locale a questo file. `importoScheda` è `payment.accontoPagato` della scheda,
 *  letto da chi chiama; `null` = nessun pagamento noto (niente da confrontare). */
export interface SchedaChat extends SchedaPerAbbinamento {
  importoScheda: number | null;
}

/* ══ 1. LA RIGA SINTETICA: 3 RUOLI FISSI, MAI UN 4°, MAI RICOMPOSTA ═══════ */

const INDICE_INDIRIZZO = 0;
const INDICE_TESSERA = 1;
const INDICE_PAGAMENTO = 2;

/** Costruisce il gruppo e i 3 file sintetici di una riga «dalla chat», pronti per
 *  `valutaRiga`/`righePerDoppioni` di `bulk/valuta.ts` (non modificato). Vedi
 *  l'intestazione del file sul perché nome/cognome sono sempre quelli della
 *  scheda. `numero` = posizione 1-based nell'elenco delle righe del lotto (serve
 *  solo al testo «riga N» dei motivi di doppione); senza lotto, 1. */
export function rigaSinteticaDa(
  rigaChat: RigaChat,
  scheda: SchedaChat,
  numero = 1,
): { gruppo: GruppoRicomposto; file: FileLotto[] } {
  const tessera = rigaChat.chat?.tessera;
  const indirizzo = rigaChat.chat?.indirizzo;
  const pagamento = rigaChat.pagamento?.lettura;
  const file: FileLotto[] = [
    {
      indice: INDICE_INDIRIZZO,
      stato: "letto",
      impronta: "",
      tipo: "indirizzo",
      ...(indirizzo ? { lettura: indirizzo } : {}),
    },
    {
      indice: INDICE_TESSERA,
      stato: "letto",
      impronta: "",
      tipo: "tessera",
      // ⚠️ SEMPRE: nome/cognome della scheda, mai quelli letti dall'AI (vedi intestazione).
      lettura: {
        tipo: "tessera",
        nome: scheda.nome,
        cognome: scheda.cognome,
        codiceFiscale: tessera?.codiceFiscale ?? "",
        cfLetto: tessera?.cfLetto ?? "",
        // L'incertezza su nome/cognome non significa niente qui: quei due campi
        // non vengono mai dalla lettura, quindi non sono mai «da confermare» per questo.
        incerti: (tessera?.incerti ?? []).filter((x) => x !== "nome" && x !== "cognome"),
      },
    },
    {
      indice: INDICE_PAGAMENTO,
      stato: "letto",
      impronta: rigaChat.pagamento?.impronta ?? "",
      tipo: "pagamento",
      ...(pagamento ? { lettura: pagamento } : {}),
    },
  ];
  const gruppo: GruppoRicomposto = {
    idRiga: rigaChat.idRiga,
    indici: [INDICE_INDIRIZZO, INDICE_TESSERA, INDICE_PAGAMENTO],
    numero,
    tipi: ["indirizzo", "tessera", "pagamento"],
    ordineDiverso: false,
    ricomposta: false,
    // Mai «incompleta»: nasconderebbe gli asterischi di CF/indirizzo prima del bonifico (vedi intestazione).
    incompleta: false,
    mancano: [],
  };
  return { gruppo, file };
}

/** `DecisioniRiga` da una `RigaChat`: `scheda` non è mai `undefined` (PIANO §0.1
 *  punto 2) — qui è garantito dal TIPO di `RigaChat.scheda` (sempre una stringa),
 *  non da un controllo in più: la riga nasce già con la scheda scritta (T5). */
function decisioniDa(rigaChat: RigaChat): DecisioniRiga {
  return {
    idRiga: rigaChat.idRiga,
    stato: rigaChat.stato,
    modifiche: rigaChat.modifiche,
    scheda: rigaChat.scheda,
    confermata: rigaChat.confermata,
    confermeAvvisi: rigaChat.confermeAvvisi,
    emessa: rigaChat.emessa,
  };
}

function ingressoDa(rigaChat: RigaChat, scheda: SchedaChat, numero = 1): IngressoRiga {
  const { gruppo, file } = rigaSinteticaDa(rigaChat, scheda, numero);
  return { gruppo, file, decisioni: decisioniDa(rigaChat) };
}

/* ══ 2. IL MOTIVO «MANCA IL PAGAMENTO» E IL CONFRONTO DEGLI IMPORTI ══════ */

/** Ridondanti con «manca il pagamento»: nascono da `esaminaRiga` per la sola
 *  assenza del pagamento e si tolgono SOLO in quel caso (PIANO §0.1 punto 3). */
const CODICI_SENZA_PAGAMENTO = new Set(["importo_mancante", "modo_mancante", "data_mancante"]);

const MOTIVO_MANCA_PAGAMENTO: Motivo = {
  codice: "chat_manca_pagamento",
  gravita: "blocca",
  strutturale: true,
  testo: "Manca lo screenshot del bonifico ricevuto: caricalo per completare questa riga.",
};

function motivoImportoDiverso(letto: number, inScheda: number): Motivo {
  return {
    codice: "chat_importo_diverso",
    gravita: "conferma",
    campo: "importo",
    testo: `L'importo nello screenshot (${scriviEuro(letto)} €) non corrisponde al pagamento già registrato in scheda (${scriviEuro(inScheda)} €): controlla quale dei due è giusto.`,
  };
}

const PESO: Record<Motivo["gravita"], number> = { blocca: 0, conferma: 1, avviso: 2 };

/** Dopo `valutaRiga` (bulk, non toccata): gli avvisi di T2, il filtro sul
 *  pagamento mancante o il confronto degli importi, poi si richiama `statoDi`
 *  per il verdetto finale. Una riga chiusa (emessa/scartata) non richiama
 *  `esaminaRiga`, e nemmeno questo: resta com'è, come nella bulk. */
function rifinisci(rigaChat: RigaChat, scheda: SchedaChat, base: RigaValutata): RigaValutata {
  if (rigaChat.stato !== "aperta") return base;

  let motivi: Motivo[] = [...base.motivi, ...(rigaChat.chat?.motivi ?? [])];
  if (!rigaChat.pagamento?.lettura) {
    motivi = [
      ...motivi.filter((m) => !CODICI_SENZA_PAGAMENTO.has(m.codice)),
      MOTIVO_MANCA_PAGAMENTO,
    ];
  } else if (
    scheda.importoScheda !== null &&
    base.campi.importo !== null &&
    base.campi.importo !== scheda.importoScheda
  ) {
    motivi = [...motivi, motivoImportoDiverso(base.campi.importo, scheda.importoScheda)];
  }
  const ordinati = [...motivi].sort((a, b) => PESO[a.gravita] - PESO[b.gravita]);
  const { stato, emettibile } = statoDi(
    ordinati,
    rigaChat.confermeAvvisi ?? [],
    !!rigaChat.confermata,
  );
  const visibile = stato === "pronto" && rigaChat.confermata ? "confermata" : stato;
  return { ...base, motivi: ordinati, stato: visibile, emettibile };
}

/* ══ 3. LE ENTRATE: UNA RIGA, O TUTTO IL LOTTO ═══════════════════════════ */

/** Una riga, con le altre righe aperte del lotto già viste (per i doppioni:
 *  `altre`, costruita da chi chiama con `righePerDoppioni`, come `valutaRiga`
 *  della bulk — senza, la riga non vede le altre). */
export function valutaRigaChat(
  rigaChat: RigaChat,
  scheda: SchedaChat,
  ctx: ContestoValutazione,
  altre: RigaPerDoppioni[] = [],
): RigaValutata {
  return rifinisci(rigaChat, scheda, valutaRiga(ingressoDa(rigaChat, scheda), ctx, altre));
}

/** Tutto il lotto, parallela a `valutaLotto` della bulk: le altre righe si
 *  ricavano da `righe` (con `righePerDoppioni`, bulk/valuta.ts non toccata),
 *  quindi non si può dimenticare di vederle. */
export function valutaLottoChat(
  righe: { riga: RigaChat; scheda: SchedaChat }[],
  ctx: ContestoValutazione,
): { righe: RigaValutata[] } {
  const ingressi = righe.map(({ riga, scheda }, i) => ingressoDa(riga, scheda, i + 1));
  const altre = righePerDoppioni(ingressi, ctx);
  return {
    righe: righe.map(({ riga, scheda }, i) =>
      rifinisci(riga, scheda, valutaRiga(ingressi[i], ctx, altre)),
    ),
  };
}
