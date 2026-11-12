/** ── FATTURE BULK · L'AZIONE `emetti-riga` (emissione.server.ts) ──────────
 *  Commessa 2026-11-12-fatture-bulk, T12 (PIANO §5, D10-D14). UNA riga per chiamata, sul server, con le
 *  porte iniettate di `bulk.server.ts` (si prova con finti). Importabile senza ambiente.
 *
 *  ── L'ORDINE, E IL PERCHÉ ─────────────────────────────────────────────────
 *   1. emittente del lotto (un'altra scheda sta emettendo? → ferma) e lucchetto globale (rilasciato SEMPRE);
 *   2. rilettura del lotto (file, righe), poi le fatture emesse, le bozze e le schede;
 *   3. il centro riletto, subito prima di valutare: `firmaImpostazioni` uguale a quella del lotto e `controllaLotto`
 *      vuoto (R1) — ma solo se si sta per emettere davvero (una riga già emessa o scartata non lo richiede);
 *   4. `cercaPerOrigine` PRIMA di tutto il resto: se la fattura di questa riga c'è già (risposta persa, doppio
 *      clic, seconda scheda) si chiude la riga e si risponde «emessa»: MAI una seconda fattura;
 *   5. `valutaRigaNelLotto` con il contesto completo (tutte le schede, tutte le emesse, la serie del centro):
 *      emette SOLO se `emettibile` (mai perché «c'è una fattura simulata»). Quel che non lo è → `saltata`;
 *   6. la scheda esiste, poi `emettiProtettoSu`;
 *   7. la riga si chiude con `chiudiRiga` (compare-and-swap, mai una scrittura a mano) che svuota letture e
 *      modifiche e toglie le foto dal bucket;
 *   8. se il lotto è concluso si chiude da solo; altrimenti `spazzaOrfani` ritenta la rimozione delle foto fallita.
 *
 *  ── COME RISPONDE ─────────────────────────────────────────────────────────
 *   `emessa` (anche per una riga già emessa: idempotente) · `saltata` (la riga, per un motivo SUO, non si può
 *   emettere: le altre proseguono) · `ferma` (errore di sistema: si ferma il lotto). Un salto di numeri
 *   (qualcuno ha emesso in mezzo) NON ferma niente: va nell'esito (D14).
 *  ⚠️ Una fattura già scritta non si perde mai per un guasto dopo: se la riga non si riesce a chiudere la
 *   risposta è `ferma`, ma la fattura c'è e la ripresa la riconosce.
 *  ⚠️ Nessun `console.` e nessun dato personale nei log: `porte.log` riceve solo codici. */
import { cercaPerOrigine, emettiProtettoSu } from "./emissione-bulk";
import { leggiAziendaSu } from "../archivio";
import type { DatiAzienda, Fattura } from "../tipi";
import {
  chiaveEmittente,
  CHIAVE_LUCCHETTO,
  lottoValido,
  SCADENZA_EMITTENTE_MS,
  SCADENZA_LUCCHETTO_MS,
} from "./chiavi";
import {
  chiudiLottoSeConcluso,
  chiudiRiga,
  ErroreBulk,
  fileDelLotto,
  righeDelLotto,
  spazzaOrfani,
  testataDi,
  type PorteBulk,
} from "./bulk.server";
import { leggiPrecedente, prendi, rilascia, rinnova } from "./lucchetto.server";
import { ricomponi } from "./raggruppa";
import { controllaLotto, firmaImpostazioni } from "./regole-lotto";
import { oggiItaliano } from "./regole-riga";
import type {
  CodiceErrore,
  FileLotto,
  IngressoRiga,
  Motivo,
  RispostaEmettiRiga,
  SchedaPerAbbinamento,
  TestataLotto,
  TipoFile,
} from "./tipi";
import { valutaRigaNelLotto } from "./valuta";

const PREFISSO_EMESSE = "fattura:";
const PREFISSO_BOZZE = "fattura_bozza:";

/** Una scheda del CRM (`crm_leads`: id + `data`) nella forma che serve all'abbinamento. Del telefono bastano le
 *  ultime 9 cifre. Sta qui perché la rotta ne ha bisogno per costruire la porta `schede`. */
export function schedaDaLead(
  id: string,
  d: { nome?: unknown; cognome?: unknown; codiceFiscale?: unknown; telefono?: unknown },
): SchedaPerAbbinamento {
  return {
    id,
    nome: String(d.nome ?? ""),
    cognome: String(d.cognome ?? ""),
    codiceFiscale: String(d.codiceFiscale ?? ""),
    telefono: String(d.telefono ?? "")
      .replace(/\D/g, "")
      .slice(-9),
  };
}

const ferma = (codice: CodiceErrore, messaggio?: string): RispostaEmettiRiga => ({
  ok: true,
  esito: "ferma",
  codice,
  messaggio: messaggio ?? new ErroreBulk(codice).messaggio,
});

const saltata = (motivi: Motivo[]): RispostaEmettiRiga => ({ ok: true, esito: "saltata", motivi });

const motivoUnico = (codice: string, testo: string): Motivo => ({
  codice,
  gravita: "blocca",
  testo,
});

/** Le fatture di un prefisso, lette a pagine per chiave. Le righe illeggibili si saltano (come `archivio.ts`). */
async function leggiFatture(porte: PorteBulk, prefisso: string): Promise<Fattura[]> {
  const out: Fattura[] = [];
  for (const r of await porte.archivio.leggiPrefissoPerChiave(prefisso)) {
    try {
      const f = JSON.parse(r.value) as Fattura;
      if (f && typeof f === "object" && f.id) out.push(f);
    } catch {
      /* una riga rotta non abbatte l'elenco */
    }
  }
  return out;
}

/** R1: il centro com'è ADESSO. Cambiato rispetto al lotto, o con dati che lo SdI scarterebbe → si ferma il lotto. */
async function centroOk(
  porte: PorteBulk,
  testata: TestataLotto,
): Promise<{ azienda: DatiAzienda } | { stop: RispostaEmettiRiga }> {
  const azienda = await leggiAziendaSu(porte.archivio);
  if (firmaImpostazioni(azienda) !== testata.firmaImpostazioni)
    return { stop: ferma("impostazioni_cambiate") };
  const motivi = controllaLotto(azienda);
  if (motivi.length)
    return { stop: ferma("impostazioni_cambiate", motivi.map((m) => m.testo).join(" ")) };
  return { azienda };
}

/** Dopo che la riga è chiusa: la rimozione delle foto che fosse fallita si ritenta (D11d), poi il lotto si
 *  chiude se è concluso. Nessuno dei due fa fallire la risposta: la riga è già emessa. */
async function dopoLaRiga(
  porte: PorteBulk,
  lotto: string,
  fattura: { id: string; numero: number; data: string },
  salto?: { da: number; a: number },
): Promise<RispostaEmettiRiga> {
  //  Prima la chiusura: un lotto concluso sparisce intero, orfani compresi, e non serve altro. Altrimenti si ritenta la
  //  rimozione delle foto rimaste (poi `pulisci` farà il resto).
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

/** Chiude la riga come emessa. Se non ci riesce la fattura c'è comunque: si dice chiaro e si ferma. */
async function chiudiComeEmessa(
  porte: PorteBulk,
  lotto: string,
  idRiga: string,
  fattura: { id: string; numero: number; data: string },
): Promise<RispostaEmettiRiga | null> {
  try {
    await chiudiRiga(porte, lotto, idRiga, "emessa", fattura);
    return null;
  } catch (e) {
    const codice: CodiceErrore = e instanceof ErroreBulk ? e.codice : "scrittura_fallita";
    porte.log(`riga_non_chiusa ${codice}`);
    return ferma(
      codice,
      `La fattura n. ${fattura.numero} è stata emessa, ma non sono riuscito a segnare la riga come fatta: ` +
        `riapri il caricamento (la fattura non verrà rifatta).`,
    );
  }
}

export async function emettiRiga(
  porte: PorteBulk,
  richiesta: { lotto: string; idRiga: string; emittente: string },
): Promise<RispostaEmettiRiga> {
  const { lotto, idRiga, emittente } = richiesta;
  if (!lottoValido(lotto) || !/^\d{4}(-\d{4}){0,2}$/.test(idRiga) || !emittente)
    return ferma("richiesta_non_valida");
  const testata = await testataDi(porte, lotto);
  if (!testata) return ferma("non_trovato");

  //  1. L'emittente del lotto: la scheda che lo è già si rinnova; un'altra, viva, fa fermare questa.
  const preso = await prendi(
    porte.lucchetto,
    chiaveEmittente(lotto),
    emittente,
    SCADENZA_EMITTENTE_MS,
    porte.adesso(),
  );
  if (!preso.ok) return ferma("emittente_occupato");
  //  Il lucchetto globale: una sola emissione per volta in tutto il CRM (due lotti, due utenti).
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
  porte: PorteBulk,
  testata: TestataLotto,
  idRiga: string,
  emittente: string,
): Promise<RispostaEmettiRiga> {
  const lotto = testata.lotto;

  //  2. Il lotto com'è ora.
  const file = await fileDelLotto(porte, lotto);
  const decisioni = await righeDelLotto(porte, lotto);
  const mia = decisioni.get(idRiga);

  if (mia?.stato === "scartata")
    return saltata([motivoUnico("riga_scartata", "Questa riga è stata scartata: non si emette.")]);
  //  Già emessa e chiusa (risposta persa, doppio clic): idempotente, e le foto rimaste si ritentano.
  if (mia?.stato === "emessa" && mia.emessa) return dopoLaRiga(porte, lotto, mia.emessa);

  const tipi = [...file.values()].map((f) => ({
    indice: f.indice,
    tipo: (f.tipo || "altro") as TipoFile,
  }));
  const gruppi = ricomponi(tipi);
  if (!gruppi.some((g) => g.idRiga === idRiga))
    return saltata([motivoUnico("riga_non_trovata", "Questa riga non c'è nel caricamento.")]);

  //  4. La fattura di questa riga c'è già? (la riga è ancora «aperta» qui, ma l'archivio la conosce)
  const emesse = await leggiFatture(porte, PREFISSO_EMESSE);
  const gia = cercaPerOrigine(emesse, lotto, idRiga);
  if (gia) {
    const f = { id: gia.id, numero: gia.numero, data: gia.data };
    const errore = await chiudiComeEmessa(porte, lotto, idRiga, f);
    return errore ?? dopoLaRiga(porte, lotto, f);
  }

  //  5. La stessa valutazione del browser, con TUTTE le righe (i doppioni fra righe) e TUTTE le schede.
  const bozze = await leggiFatture(porte, PREFISSO_BOZZE);
  const schede = await porte.schede();
  //  Il centro (R1) si rilegge QUI, dopo tutte le letture lente e subito prima di valutare ed emettere: le due cose
  //  seguenti non aspettano più niente di lungo. Una sola lettura invece di due (ogni sottorichiesta conta, D13).
  const centro = await centroOk(porte, testata);
  if ("stop" in centro) return centro.stop;
  const tutti: FileLotto[] = [...file.values()];
  const righe: IngressoRiga[] = gruppi.map((gruppo) => ({
    gruppo,
    file: tutti,
    decisioni: decisioni.get(gruppo.idRiga),
  }));
  const valutata = valutaRigaNelLotto(idRiga, righe, {
    lotto: testata,
    azienda: centro.azienda,
    oggi: oggiItaliano(new Date(porte.adesso())),
    emesse,
    bozze,
    schede,
    //  shortcut: gli altri lotti aperti non si leggono (costerebbero decine di sottorichieste); non serve: la prima
    //  riga emessa mette la sua impronta nell'archivio e l'altra, dopo, la vede fra le emesse. Se serve vederli
    //  prima, passare qui le impronte dei lotti aperti.
    impronteAltriLotti: [],
  });
  if (!valutata.emettibile || !valutata.fattura) {
    //  Una riga «pronta» ma non confermata non ha motivi: si dice perché non parte.
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
  //  La scheda deve esistere davvero (finisce in `leadId`).
  if (valutata.scheda !== null && !schede.some((s) => s.id === valutata.scheda))
    return saltata([
      motivoUnico(
        "scheda_non_trovata",
        "La scheda scelta non esiste più: scegline un'altra o togli il collegamento.",
      ),
    ]);

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
    porte.archivio,
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
  //  7. La riga si chiude con `chiudiRiga` (CAS, svuotamento, foto). Poi l'emittente ricorda l'ultimo numero.
  const nonChiusa = await chiudiComeEmessa(porte, lotto, idRiga, emessa);
  if (nonChiusa) return nonChiusa;
  const rinnovato = await rinnova(
    porte.lucchetto,
    chiaveEmittente(lotto),
    emittente,
    SCADENZA_EMITTENTE_MS,
    porte.adesso(),
    { anno: esito.fattura.anno, serie, numero: esito.fattura.numero },
  );
  //  La fattura c'è e la riga è chiusa: si risponde «emessa». Se l'emittente è passato ad altri, la riga dopo si ferma.
  if (!rinnovato.ok) porte.log("emittente_perso");

  return dopoLaRiga(porte, lotto, emessa, esito.salto ?? undefined);
}
