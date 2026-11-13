/** ── FATTURE DALLA CHAT · L'AZIONE `emetti-riga` (emissione-chat.server.ts) ──
 *  Commessa 2026-11-13-fatture-dalla-chat, T6 (PIANO §4). Stessa sequenza a 8
 *  passi di `emettiRiga` (bulk/emissione.server.ts), adattata al magazzino di
 *  `chat.server.ts` (una riga sola per cliente, mai 3 file da ricomporre):
 *   1. emittente del lotto (un'altra scheda sta emettendo? → ferma) e lucchetto
 *      globale (`CHIAVE_LUCCHETTO` della bulk, import: una sola emissione per
 *      volta in tutto il CRM, bulk o chat che sia — PIANO §0.2), rilasciato SEMPRE;
 *   2. rilettura del lotto (righe, pagamenti), poi le fatture emesse, le bozze
 *      e le schede;
 *   3. il centro riletto, subito prima di valutare (`centroOk`, T0b, import) —
 *      ma solo se si sta per emettere davvero;
 *   4. `cercaPerOrigine` PRIMA di tutto il resto: se la fattura di questa riga
 *      c'è già (risposta persa, doppio clic) si chiude la riga e si risponde
 *      «emessa»: MAI una seconda fattura;
 *   5. `valutaLottoChat` (T3) con TUTTE le righe del lotto (per i doppioni fra
 *      righe) e tutte le schede: emette SOLO se `emettibile`;
 *   6. `emettiProtettoSu` (import, sull'archivio protetto per `fattura:*`);
 *   7. la riga si chiude con `chiudiRigaChat` (T5, import: CAS, svuota la
 *      lettura e il pagamento, toglie il bonifico dal bucket);
 *   8. se il lotto è concluso si chiude da solo (`chiudiLottoSeConcluso`, T5);
 *      altrimenti `spazzaOrfani` (T5) ritenta la rimozione del bonifico fallita.
 *
 *  ── ⚠️ PERCHÉ `valutaLottoChat` E NON UNA NUOVA `valutaRigaChatNelLotto` ────
 *  T3 (`valutaRigaChat`) ha già un 4° parametro opzionale `altre` apposta per
 *  questo (specchio di `valutaRiga` della bulk), ma costruire `altre` a mano
 *  richiederebbe rifare qui la stessa cosa che `valutaLottoChat` già fa da sé
 *  (ingressi + `righePerDoppioni`, bulk/valuta.ts non toccato): si valuta
 *  l'INTERO lotto (come fa `dentroIlLucchetto` della bulk con `gruppi.map(...)`
 *  per TUTTI i gruppi, non solo quello da emettere) e si estrae il risultato
 *  della riga che interessa. Stesso principio della bulk: `valutaRigaNelLotto`
 *  non esiste come funzione a parte, è `valuta()` chiamata con `righePerDoppioni`
 *  di tutte le righe — qui l'equivalente è `valutaLottoChat` più un `.find`.
 *
 *  ── ⚠️ DECISIONI PRESE QUI (T6), DA SEGNALARE SULLA LAVAGNA ─────────────────
 *  · `SchedaChatRiga` (chat.server.ts) non portava il CF già scritto a mano
 *    sulla scheda: T5 non chiamava mai `valuta-chat.ts`, quindi non serviva.
 *    Qui serve per davvero (`cfDiversoDellaScheda`, SPEC §5): aggiunto il
 *    campo `codiceFiscale` a `SchedaChatRiga` (chat.server.ts) e alla query
 *    vera (`api.crm.fatture-chat.ts`) — l'unico tocco a quei due file oltre
 *    agli `export` di magazzino e alla riga `emettiRiga`.
 *  · `centroOk` (bulk/emissione.server.ts, T0b) chiede un `PorteBulk` intero
 *    ma usa SOLO `.archivio` (letto nel codice, non supposto): si passa un
 *    adattatore (`comePorteBulk`), stesso «solito inganno sui tipi» già in
 *    uso in `chat.server.ts` (`comeLead`) per un adattatore strutturale fra
 *    porte diverse con lo stesso campo.
 *  · I doppioni fra lotti di specie diversa (bulk vs chat) NON si leggono:
 *    `impronteAltriLotti: []` sempre (decisione dell'architetto, PIANO §0,
 *    stessa scelta già fatta dalla bulk per sé stessa) — i doppioni contro le
 *    fatture GIÀ EMESSE (bulk o chat) restano coperti al 100% da `cercaPerOrigine`/
 *    `trovaDoppioni` sulle `emesse`, qui esattamente come nella bulk.
 *  ⚠️ Nessun `console.` e nessun dato personale nei log: `porte.log` riceve solo codici. */
import type { Fattura } from "../tipi";
import {
  CHIAVE_LUCCHETTO,
  SCADENZA_EMITTENTE_MS,
  SCADENZA_LUCCHETTO_MS,
  lottoValido,
} from "../bulk/chiavi";
import { archivioPerEmissione, centroOk } from "../bulk/emissione.server";
import { cercaPerOrigine, emettiProtettoSu } from "../bulk/emissione-bulk";
import { leggiPrecedente, prendi, rilascia, rinnova } from "../bulk/lucchetto.server";
import { oggiItaliano } from "../bulk/regole-riga";
import { schedaDaLead } from "../bulk/scheda-da-lead";
import type {
  CodiceErrore,
  ContestoValutazione,
  Motivo,
  RispostaEmettiRiga,
  SchedaPerAbbinamento,
} from "../bulk/tipi";
import type { PorteBulk } from "../bulk/bulk.server";
import {
  chiudiLottoSeConcluso,
  chiudiRigaChat,
  conPagamento,
  ErroreChat,
  pagamentiDelLotto,
  righeSalvateDelLotto,
  spazzaOrfani,
  testataDi,
  type PorteChat,
  type RigaSalvata,
  type SchedaChatRiga,
} from "./chat.server";
import { chiaveEmittente, idRigaValido } from "./chiavi";
import { valutaLottoChat, type SchedaChat } from "./valuta-chat";
import type { RigaChat, TestataLottoChat } from "./tipi";

const PREFISSO_EMESSE = "fattura:";
const PREFISSO_BOZZE = "fattura_bozza:";

const ferma = (codice: CodiceErrore, messaggio?: string): RispostaEmettiRiga => ({
  ok: true,
  esito: "ferma",
  codice,
  messaggio: messaggio ?? new ErroreChat(codice).messaggio,
});
const saltata = (motivi: Motivo[]): RispostaEmettiRiga => ({ ok: true, esito: "saltata", motivi });
const motivoUnico = (codice: string, testo: string): Motivo => ({
  codice,
  gravita: "blocca",
  testo,
});

/** Le fatture di un prefisso, lette a pagine per chiave (come `leggiFatture` di bulk/emissione.server.ts,
 *  qui duplicata perché quella non è esportata: lettura generica dell'archivio, non una regola fiscale). */
async function leggiFatture(porte: PorteChat, prefisso: string): Promise<Fattura[]> {
  const out: Fattura[] = [];
  for (const r of await porte.archivio.leggiPrefissoPerChiave(prefisso)) {
    try {
      const f = JSON.parse(r.value) as Fattura;
      if (f && typeof f === "object" && f.id) out.push(f);
    } catch {
      /* una riga rotta non abbatte l'elenco, come archivio.ts */
    }
  }
  return out;
}

/** `centroOk` (T0b) chiede un `PorteBulk` ma legge solo `.archivio`: vedi l'intestazione del file. */
function comePorteBulk(porte: PorteChat): PorteBulk {
  return { archivio: porte.archivio } as unknown as PorteBulk;
}

/** `SchedaChatRiga` (il magazzino) → `SchedaChat` (quello che chiede `valuta-chat.ts`): la parte comune
 *  viene da `schedaDaLead` (import, non copiata); `importoScheda` è il pagamento già noto in scheda
 *  (SPEC §5, PIANO §0.1 punto 3) — `null` se la scheda non ha un importo numerico registrato. */
function schedaChatDa(s: SchedaChatRiga): SchedaChat {
  return {
    ...schedaDaLead(s.id, s),
    importoScheda: typeof s.payment?.accontoPagato === "number" ? s.payment.accontoPagato : null,
  };
}

async function dopoLaRiga(
  porte: PorteChat,
  lotto: string,
  fattura: { id: string; numero: number; data: string },
  salto?: { da: number; a: number },
): Promise<RispostaEmettiRiga> {
  const lottoChiuso = await chiudiLottoSeConcluso(porte, lotto);
  if (!lottoChiuso)
    await spazzaOrfani(porte, lotto).catch(() => porte.log("rimozione_file_fallita"));
  return {
    ok: true,
    esito: "emessa",
    fattura,
    ...(salto ? { saltoDiNumeri: salto } : {}),
    lottoChiuso,
  };
}

async function chiudiComeEmessa(
  porte: PorteChat,
  lotto: string,
  idRiga: string,
  fattura: { id: string; numero: number; data: string },
): Promise<RispostaEmettiRiga | null> {
  try {
    await chiudiRigaChat(porte, lotto, idRiga, "emessa", fattura);
    return null;
  } catch (e) {
    const codice: CodiceErrore = e instanceof ErroreChat ? e.codice : "scrittura_fallita";
    porte.log(`riga_non_chiusa ${codice}`);
    return ferma(
      codice,
      `La fattura n. ${fattura.numero} è stata emessa, ma non sono riuscito a segnare la riga come fatta: ` +
        `riapri il caricamento (la fattura non verrà rifatta).`,
    );
  }
}

export async function emettiRigaChat(
  porte: PorteChat,
  richiesta: { lotto: string; idRiga: string; emittente: string },
): Promise<RispostaEmettiRiga> {
  const { lotto, idRiga, emittente } = richiesta;
  if (!lottoValido(lotto) || !idRigaValido(idRiga) || !emittente)
    return ferma("richiesta_non_valida");
  const testata = await testataDi(porte, lotto);
  if (!testata) {
    //  Lotto sparito: forse l'ultima riga era questa e la risposta è andata persa (il lotto si chiude
    //  da solo quando ogni riga è emessa/scartata). Una sola lettura delle emesse: niente lucchetto.
    const gia = cercaPerOrigine(await leggiFatture(porte, PREFISSO_EMESSE), lotto, idRiga);
    if (!gia) return ferma("non_trovato");
    return {
      ok: true,
      esito: "emessa",
      fattura: { id: gia.id, numero: gia.numero, data: gia.data },
      lottoChiuso: true,
    };
  }

  //  1. L'emittente del lotto: la scheda che lo è già si rinnova; un'altra, viva, fa fermare questa.
  const preso = await prendi(
    porte.lucchetto,
    chiaveEmittente(lotto),
    emittente,
    SCADENZA_EMITTENTE_MS,
    porte.adesso(),
  );
  if (!preso.ok) return ferma("emittente_occupato");
  //  Il lucchetto globale: una sola emissione per volta in tutto il CRM (bulk o chat, due utenti).
  const io = porte.id();
  const lucchetto = await prendi(
    porte.lucchetto,
    CHIAVE_LUCCHETTO,
    io,
    SCADENZA_LUCCHETTO_MS,
    porte.adesso(),
  );
  if (!lucchetto.ok) return ferma("lucchetto_occupato");
  try {
    return await dentroIlLucchetto(porte, testata, idRiga, emittente);
  } finally {
    await rilascia(porte.lucchetto, CHIAVE_LUCCHETTO, io).catch(() =>
      porte.log("lucchetto_non_rilasciato"),
    );
  }
}

async function dentroIlLucchetto(
  porte: PorteChat,
  testata: TestataLottoChat,
  idRiga: string,
  emittente: string,
): Promise<RispostaEmettiRiga> {
  const lotto = testata.lotto;

  //  2. Il lotto com'è ora: tutte le righe e tutti i pagamenti, UNA lettura ciascuno.
  const righe = await righeSalvateDelLotto(porte, lotto);
  const pagamenti = await pagamentiDelLotto(porte, lotto);
  const mia = righe.get(idRiga);
  if (!mia)
    return saltata([motivoUnico("riga_non_trovata", "Questa riga non c'è nel caricamento.")]);

  if (mia.stato === "scartata")
    return saltata([motivoUnico("riga_scartata", "Questa riga è stata scartata: non si emette.")]);

  //  Già emessa e chiusa (risposta persa, doppio clic): idempotente. Se il pagamento non fosse
  //  ancora stato ridotto del tutto (un guasto a metà di una chiusura precedente) si completa ora.
  if (mia.stato === "emessa" && mia.emessa) {
    const pagamentoAttuale = pagamenti.get(idRiga);
    const daRidurre =
      !!pagamentoAttuale &&
      (pagamentoAttuale.percorso !== undefined ||
        pagamentoAttuale.lettura !== undefined ||
        (pagamentoAttuale.stato !== "emessa" && pagamentoAttuale.stato !== "scartata"));
    if (daRidurre) {
      const errore = await chiudiComeEmessa(porte, lotto, idRiga, mia.emessa);
      if (errore) return errore;
    }
    return dopoLaRiga(porte, lotto, mia.emessa);
  }

  //  4. La fattura di questa riga c'è già? (la riga è ancora «aperta» qui, ma l'archivio la conosce)
  const emesse = await leggiFatture(porte, PREFISSO_EMESSE);
  const gia = cercaPerOrigine(emesse, lotto, idRiga);
  if (gia) {
    const f = { id: gia.id, numero: gia.numero, data: gia.data };
    const errore = await chiudiComeEmessa(porte, lotto, idRiga, f);
    return errore ?? dopoLaRiga(porte, lotto, f);
  }

  //  5. La scheda di questa riga deve esistere ancora (RigaChat.scheda = sempre una scheda, PIANO §0.1
  //  punto 2): se è stata tolta dal CRM nel frattempo, non si può costruire la lettura sintetica (il
  //  nome/cognome che `rigaSinteticaDa` forza sono SEMPRE quelli della scheda).
  const tutteSchede = await porte.schede();
  const schedeById = new Map(tutteSchede.map((s) => [s.id, s] as const));
  const miaScheda = schedeById.get(idRiga);
  if (!miaScheda)
    return saltata([
      motivoUnico("scheda_non_trovata", "La scheda collegata a questa riga non esiste più."),
    ]);

  //  Il centro (R1) riletto subito prima di valutare ed emettere: una sola lettura, non due.
  const centro = await centroOk(comePorteBulk(porte), testata);
  if ("stop" in centro) return centro.stop;

  const bozze = await leggiFatture(porte, PREFISSO_BOZZE);
  const ctxSchede: SchedaPerAbbinamento[] = tutteSchede.map((s) => schedaDaLead(s.id, s));
  const ctx: ContestoValutazione = {
    lotto: testata,
    azienda: centro.azienda,
    oggi: oggiItaliano(new Date(porte.adesso())),
    emesse,
    bozze,
    schede: ctxSchede,
    //  Decisione dell'architetto (PIANO §0): solo altri lotti «dalla chat» aperti, mai quelli bulk — qui
    //  di default nessuno (nessun altro lotto aperto passato da chi chiama).
    impronteAltriLotti: [],
  };

  //  Tutte le righe del lotto (come `gruppi.map(...)` nella bulk), ciascuna con la SUA scheda: serve a
  //  `valutaLottoChat` per i doppioni fra righe dello stesso caricamento.
  const coppie: { riga: RigaChat; scheda: SchedaChat }[] = [];
  for (const r of righe.values() as IterableIterator<RigaSalvata>) {
    const s = schedeById.get(r.idRiga);
    if (!s) continue; // scheda sparita per QUELLA riga: non entra nel confronto dei doppioni, non blocca questa
    coppie.push({ riga: conPagamento(r, pagamenti.get(r.idRiga)), scheda: schedaChatDa(s) });
  }
  const { righe: valutate } = valutaLottoChat(coppie, ctx);
  const valutata = valutate.find((v) => v.idRiga === idRiga);
  if (!valutata)
    return saltata([motivoUnico("riga_non_trovata", "Questa riga non c'è nel caricamento.")]);

  if (!valutata.emettibile || !valutata.fattura) {
    const motivi = valutata.motivi.length
      ? valutata.motivi
      : [
          {
            codice: "non_confermata",
            gravita: "conferma" as const,
            testo: "La riga non è confermata: premi «Confermo così» e riprova.",
          },
        ];
    return saltata(motivi);
  }

  //  6. Emissione. ⚠️ `centro.azienda` è quella appena riletta: valutazione ed emissione usano la stessa.
  const fattura: Fattura = {
    ...valutata.fattura,
    creataIl: new Date(porte.adesso()).toISOString(),
  };
  const anno = Number(valutata.campi.data.slice(0, 4));
  const serie = centro.azienda.serie || "";
  const precedente = await leggiPrecedente(
    porte.lucchetto,
    chiaveEmittente(lotto),
    emittente,
    anno,
    serie,
  );
  const esito = await emettiProtettoSu(
    archivioPerEmissione(porte.archivio),
    fattura,
    centro.azienda,
    valutata.campi.data,
    precedente,
  );
  if (!esito.ok) {
    porte.log(`emissione ${esito.codice}`);
    const codice: CodiceErrore =
      esito.codice === "lettura_fallita" ? "rete" : (esito.codice as CodiceErrore);
    return ferma(codice);
  }

  const emessa = { id: esito.fattura.id, numero: esito.fattura.numero, data: esito.fattura.data };
  //  7. La riga si chiude con `chiudiRigaChat` (CAS, svuotamento, bonifico tolto dal bucket).
  const nonChiusa = await chiudiComeEmessa(porte, lotto, idRiga, emessa);
  if (nonChiusa) return nonChiusa;
  //  La fattura c'è e la riga è chiusa: qualunque cosa succeda qui la risposta resta «emessa». Se
  //  l'emittente è passato ad altri, la riga dopo si ferma da sola.
  const rinnovato = await rinnova(
    porte.lucchetto,
    chiaveEmittente(lotto),
    emittente,
    SCADENZA_EMITTENTE_MS,
    porte.adesso(),
    { anno: esito.fattura.anno, serie, numero: esito.fattura.numero },
  ).catch(() => null);
  if (!rinnovato?.ok) porte.log("emittente_perso");

  return dopoLaRiga(porte, lotto, emessa, esito.salto ?? undefined);
}
