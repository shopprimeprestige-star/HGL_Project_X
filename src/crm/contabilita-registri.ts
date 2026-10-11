/** ── I REGISTRI IVA ────────────────────────────────────────────────────────
 *
 *  Non sono un riepilogo di comodo: sono LIBRI OBBLIGATORI.
 *   · il registro delle fatture emesse — art. 23 DPR 633/72;
 *   · il registro degli acquisti — art. 25 DPR 633/72.
 *  In una verifica si chiedono quelli, non un foglio di calcolo. Tenerli in
 *  forma digitale è regolare anche senza stamparli (art. 7 c. 4-quater DL
 *  357/1994), a patto di poterli stampare su richiesta: che è esattamente
 *  quello che fa questo file.
 *
 *  ── ⚠️ IL PROTOCOLLO DEGLI ACQUISTI ───────────────────────────────────────
 *  L'art. 25 non chiede il numero del fornitore: chiede un numero NOSTRO,
 *  progressivo, nell'ordine in cui i documenti sono stati RICEVUTI. Due
 *  fatture di due fornitori diversi possono avere lo stesso numero — quello
 *  del protocollo no.
 *  Si numera quindi per data di CARICAMENTO, non per data del documento: una
 *  fattura di marzo caricata a settembre prende il protocollo di settembre, ed
 *  è giusto — è quando è entrata in contabilità. Così il protocollo di una
 *  fattura già registrata non cambia mai, perché quelle nuove arrivano sempre
 *  dopo.
 *  ⚠️ Riparte da 1 ogni anno, come vuole la prassi.
 *
 *  ── ⚠️ LE INTEGRAZIONI STANNO IN DUE REGISTRI ─────────────────────────────
 *  Un acquisto in inversione contabile si annota nel registro degli ACQUISTI
 *  (per detrarre l'imposta) e in quello delle VENDITE (per versarla): è il
 *  meccanismo, non una duplicazione. Il foglio le elenca a parte, con scritto
 *  che vanno annotate anche fra le vendite — perché un commercialista che
 *  legge solo il primo registro non le vedrebbe, e la liquidazione non
 *  tornerebbe.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { Fattura } from "./fatture/tipi";
import type { FatturaFornitore } from "./contabilita-fornitori";
import { regimeDi } from "./contabilita-regimi";

export interface RigaRegistro {
  /** Il protocollo, sugli acquisti; il numero della fattura, sulle vendite. */
  riferimento: string;
  data: string;
  /** Numero del documento del fornitore: sugli acquisti serve a ritrovarlo. */
  numeroDocumento?: string;
  chi: string;
  partitaIva: string;
  imponibile: number;
  aliquota: number;
  imposta: number;
  /** Una parola sul trattamento, quando non è quello ordinario. */
  nota?: string;
}

const c2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Quando è entrata in contabilità: è l'ordine del protocollo. */
const quandoRegistrata = (f: FatturaFornitore): string =>
  String(f.caricataIl || f.data || "").slice(0, 19);

/** ── I PROTOCOLLI, SU TUTTO L'ARCHIVIO ────────────────────────────────────
 *  ⚠️ SI CALCOLANO SU TUTTE LE FATTURE, non su quelle del periodo: un
 *   progressivo che riparte a ogni trimestre non è un progressivo. Si passa
 *   l'archivio intero e si legge il numero di quelle che servono. */
export function protocolli(tutte: FatturaFornitore[]): Map<string, string> {
  const perAnno = new Map<string, number>();
  const fuori = new Map<string, string>();
  for (const f of [...tutte].sort((a, b) =>
    quandoRegistrata(a).localeCompare(quandoRegistrata(b)),
  )) {
    const anno = String(f.data ?? "").slice(0, 4) || "0000";
    const n = (perAnno.get(anno) ?? 0) + 1;
    perAnno.set(anno, n);
    fuori.set(f.id, `${anno}/${String(n).padStart(4, "0")}`);
  }
  return fuori;
}

/** ── IL REGISTRO DELLE FATTURE EMESSE ─────────────────────────────────────
 *  Una riga per ALIQUOTA, non per fattura: l'art. 23 vuole imponibile e
 *  imposta distinti per aliquota, e una fattura con due aliquote fa due righe
 *  con lo stesso numero. */
export function righeVendite(fatture: Fattura[]): RigaRegistro[] {
  const fuori: RigaRegistro[] = [];
  for (const f of [...fatture].sort((a, b) => a.numero - b.numero)) {
    const chi = f.cliente.azienda
      ? f.cliente.denominazione
      : `${f.cliente.nome} ${f.cliente.cognome}`.trim();
    const perAliquota = new Map<number, { imponibile: number; imposta: number }>();
    for (const r of f.righe ?? []) {
      const a = Number(r.aliquota) || 0;
      const imponibile = c2((Number(r.quantita) || 0) * (Number(r.prezzoUnitario) || 0));
      const v = perAliquota.get(a) ?? { imponibile: 0, imposta: 0 };
      v.imponibile = c2(v.imponibile + imponibile);
      v.imposta = c2((v.imponibile * a) / 100);
      perAliquota.set(a, v);
    }
    //  ⚠️ Senza righe si usano i totali della fattura e si RICAVA l'aliquota:
    //   meglio un'aliquota dedotta che una riga mancante in un libro
    //   obbligatorio.
    if (perAliquota.size === 0) {
      const a = f.imponibile > 0 ? Math.round((f.imposta / f.imponibile) * 100) : 0;
      perAliquota.set(a, { imponibile: c2(f.imponibile), imposta: c2(f.imposta) });
    }
    for (const [aliquota, v] of [...perAliquota.entries()].sort((x, y) => y[0] - x[0])) {
      fuori.push({
        riferimento: `${f.numero}${f.serie ? `/${f.serie}` : ""}`,
        data: f.data,
        chi: chi || "Cliente senza nome",
        partitaIva: f.cliente.partitaIva || f.cliente.codiceFiscale || "",
        imponibile: v.imponibile,
        aliquota,
        imposta: v.imposta,
      });
    }
  }
  return fuori;
}

/** ── IL REGISTRO DEGLI ACQUISTI ───────────────────────────────────────────
 *  Ordinato per PROTOCOLLO, che è l'ordine in cui i documenti sono entrati —
 *  non per data del documento. Un registro ordinato per data del documento con
 *  i protocolli sparsi non è un registro: è un elenco. */
export function righeAcquisti(
  fornitori: FatturaFornitore[],
  numeri: Map<string, string>,
): RigaRegistro[] {
  return (
    [...fornitori]
      /*  ── ⚠️ LE PROFORMA NON ENTRANO NEL REGISTRO ─────────────────────
          L'art. 25 fa annotare le FATTURE ricevute. Una proforma non lo è: è
          la richiesta di pagamento che i fornitori esteri mandano prima di
          spedire. Annotarla vorrebbe dire mettere nei registri un documento
          che per il fisco non esiste — e, quando la fattura definitiva
          arriva, avere lo stesso acquisto due volte, con due protocolli.
          ⚠️ Il COSTO resta in contabilità: i soldi sono usciti. Quello che
           non entra è la registrazione IVA, che è un'altra cosa. */
      .filter((f) => !f.proforma)
      .sort((a, b) => (numeri.get(a.id) ?? "").localeCompare(numeri.get(b.id) ?? ""))
      .map((f) => {
        const r = regimeDi(f.regime ?? "italiana");
        const imponibile = c2(f.imponibile > 0 ? f.imponibile : f.totale);
        /*  ── ⚠️ NEL REGISTRO CI VA L'IMPOSTA DEL DOCUMENTO ────────────────
          Non quella detraibile: sono due cose diverse. L'art. 25 chiede di
          annotare la fattura com'è; se poi quell'imposta non si detrae — un
          carburante pagato in contanti, un'auto — è la LIQUIDAZIONE a non
          portarla in detrazione, non il registro a nasconderla. Un registro
          che salta l'imposta di una fattura che ce l'ha non torna con il
          documento che gli sta accanto.
          ⚠️ E il segno si gira UNA volta sola. Prendendola da
           `effettiContabili` — che il segno lo ha già girato — una nota di
           credito usciva con l'imposta POSITIVA e l'imponibile negativo: due
           numeri che si contraddicono nella stessa riga. */
        const impostaDocumento = r.autoliquida
          ? c2((imponibile * (Number(f.aliquotaReverse) || 22)) / 100)
          : c2(f.imposta);
        const segno = f.notaDiCredito ? -1 : 1;
        const aliquota = r.autoliquida
          ? Number(f.aliquotaReverse) || 22
          : imponibile > 0
            ? Math.round((c2(f.imposta) / imponibile) * 100)
            : 0;
        return {
          riferimento: numeri.get(f.id) ?? "—",
          data: f.data,
          numeroDocumento: f.numero,
          chi: f.fornitore,
          partitaIva: f.partitaIva,
          imponibile: c2(imponibile * segno),
          aliquota,
          imposta: c2(impostaDocumento * segno),
          nota: f.notaDiCredito
            ? "nota di credito"
            : r.autoliquida
              ? `inversione contabile · ${r.tipoDocumento || "da precisare"}`
              : r.inDogana
                ? "importazione: IVA in dogana"
                : undefined,
        };
      })
  );
}

/** Le sole integrazioni: vanno annotate anche fra le vendite. */
export const soloIntegrazioni = (righe: RigaRegistro[]): RigaRegistro[] =>
  righe.filter((r) => (r.nota ?? "").startsWith("inversione contabile"));

/** I totali per aliquota, che è come si chiude un registro. */
export function totaliPerAliquota(
  righe: RigaRegistro[],
): { aliquota: number; imponibile: number; imposta: number }[] {
  const m = new Map<number, { imponibile: number; imposta: number }>();
  for (const r of righe) {
    const v = m.get(r.aliquota) ?? { imponibile: 0, imposta: 0 };
    v.imponibile = c2(v.imponibile + r.imponibile);
    v.imposta = c2(v.imposta + r.imposta);
    m.set(r.aliquota, v);
  }
  return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([aliquota, v]) => ({ aliquota, ...v }));
}
