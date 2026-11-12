/** ── FATTURE BULK · REGOLE DI LOTTO (regole-lotto.ts) ──────────────────────
 *  Quello che vale per TUTTO il lavoro e non per una riga: i dati del centro
 *  (R1-R4 di NOTE-FISCALI), la firma che dice se sono cambiati, e il riepilogo
 *  per il commercialista. Allineato a NOTE-FISCALI e VERIFICA-FISCALE: se il
 *  commercialista cambia qualcosa, si cambia qui e in da-importo-a-fattura.ts.
 *
 *  ⚠️ IL LOTTO SI BLOCCA, NON SI CORREGGE. Aliquota 0 (bollo da 2 € oltre
 *   77,47 €, non gestito), regime e aliquota che non si parlano (RF01 vuole
 *   un'aliquota, RF19/RF02 no), dati del centro incompleti: ogni motivo è un
 *   `blocca` e dice dove si sistema («Dati per la fattura»). */
import { etichettaNumero, mancanzeAzienda } from "../archivio";
import { modoDi } from "../modi-di-incasso";
import { CLIENTE_VUOTO, type DatiAzienda, type Fattura } from "../tipi";
import { problemiXml } from "../xml";
import { totaleNelFile, ultimoGiornoUtile } from "./da-importo-a-fattura";
import type { Motivo } from "./tipi";

/** Una fattura perfetta in tutto TRANNE che per il centro: così i `bloccanti` di `problemiXml`
 *  che restano sono quelli di «CHI EMETTE» (xml.ts non li separa, e non lo si tocca).
 *  La prova «azienda a posto → nessun motivo» fa da guardia se `problemiXml` ne aggiunge di nuovi. */
const FATTURA_PERFETTA: Fattura = {
  id: "2000-0001", stato: "emessa", numero: 1, anno: 2000, serie: "", data: "2000-01-01", dataPagamento: "2000-01-01",
  tipo: "unica", leadId: "x", leadNome: "X X", preventivoRef: "", causale: "X",
  cliente: { ...CLIENTE_VUOTO, nome: "X", cognome: "X", codiceFiscale: "XXXXXX00X00X000X", indirizzo: "X", cap: "00000", comune: "X", provincia: "XX" },
  righe: [{ descrizione: "X", quantita: 1, prezzoUnitario: 1, aliquota: 22 }],
  imponibile: 1, imposta: 0.22, totale: 1.22, creataIl: "", emessaIl: "",
};

const blocco = (codice: string, testo: string): Motivo => ({ codice, gravita: "blocca", testo });

/** R2-R4 e i bloccanti «CHI EMETTE» di `problemiXml`: se non vuoto, il lotto non parte (sono tutti `blocca`). */
export function controllaLotto(azienda: DatiAzienda): Motivo[] {
  const motivi: Motivo[] = [];
  const aliquota = Number(azienda.aliquotaPredefinita);
  const regime = String(azienda.regimeFiscale ?? "").trim().toUpperCase();

  // R3. Il regime ordinario vuole un'IVA; forfettario e minimi no: se non si parlano, uno dei due è sbagliato.
  if ((regime === "RF01" && !(aliquota > 0)) || ((regime === "RF19" || regime === "RF02") && aliquota > 0))
    motivi.push(blocco("regime_aliquota", `Il regime fiscale (${regime}) e l'aliquota IVA (${Number.isFinite(aliquota) ? aliquota : "non valida"}%) non coincidono: correggi in «Dati per la fattura» prima di caricare.`));

  // R4. Senza IVA servirebbe il bollo da 2 € oltre 77,47 €: il CRM non lo sa fare, quindi non fattura.
  if (!(aliquota > 0))
    motivi.push(blocco("aliquota_zero_bollo", "L'aliquota IVA del centro è zero: sulle operazioni senza IVA oltre 77,47 € serve il bollo da 2 €, che questo caricamento non gestisce. Non si emette finché non c'è l'IVA in «Dati per la fattura» o il bollo non è stato previsto."));

  // R2. shortcut: due passaggi invece di unire i due elenchi (si ripeterebbero «manca la ragione sociale»);
  // dopo aver sistemato i campi mancanti, il secondo passaggio mostra l'eventuale resto (P.IVA, CAP…).
  const mancano = mancanzeAzienda(azienda);
  if (mancano.length) motivi.push(blocco("azienda_incompleta", `Mancano i dati del centro: ${mancano.join(", ")}. Completali in «Dati per la fattura».`));
  else
    for (const b of problemiXml(FATTURA_PERFETTA, azienda).bloccanti) motivi.push(blocco("azienda_xml", `${b}. Correggilo in «Dati per la fattura»: con questo dato lo SdI scarterebbe tutte le fatture.`));

  return motivi;
}

/** Firma delle impostazioni: se cambia a metà lavoro l'emissione si ferma (R1). Nessun dato leggibile dentro.
 *  Conta quello che cambia i conti e i numeri (aliquota, regime, serie, da che numero e anno si parte); sede e IBAN no.
 *  shortcut: hash non crittografico a 53 bit (cyrb53): serve a vedere un cambiamento, non a difendere un segreto. */
export function firmaImpostazioni(azienda: DatiAzienda): string {
  const s = JSON.stringify([
    Number(azienda.aliquotaPredefinita),
    String(azienda.regimeFiscale ?? "").trim().toUpperCase(),
    String(azienda.serie ?? "").trim(),
    Number(azienda.primoNumero),
    Number(azienda.annoNumerazione),
  ]);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

export interface RigaRiepilogoCommercialista {
  numero: string;
  data: string;
  cliente: string;
  codiceFiscale: string;
  imponibile: number;
  iva: number;
  totale: number;
  /** Il totale che dice il file XML che il commercialista importa (può scostarsi di un centesimo, R10).
   *  null = non calcolato (non è stato passato il centro). */
  totaleNelFile: number | null;
  modo: string;
  riferimento: string;
  /** Mese di competenza IVA (AAAA-MM) = mese del pagamento. */
  meseCompetenza: string;
  ultimoGiornoUtile: string;
}

/** Le note da stampare sopra il riepilogo (VERIFICA-FISCALE, domande 3 e 6). */
export const NOTE_RIEPILOGO_COMMERCIALISTA: string[] = [
  "Il termine di 12 giorni finisce all'invio allo SdI, che fa il commercialista: il CRM numera e data soltanto. L'«ultimo giorno utile» è una stima in giorni di calendario; il mese di competenza IVA è il mese del pagamento.",
  "Per gli stessi incassi può essere già stato emesso uno scontrino o un documento commerciale: il CRM non lo controlla.",
  "Il totale nel file XML può scostarsi di un centesimo dall'importo pagato, perché il file ricalcola l'IVA: la colonna «totale nel file» serve a riconciliare riga per riga.",
  "Sistema TS: ATECO e categoria del centro vanno confermati come «non tenuta» all'invio dei dati al Sistema TS (e quindi senza codici di spesa sanitaria nel file); se la risposta fosse «tenuta», nessuna riga va emessa.",
  "Fatture tardive: per i pagamenti più vecchi di 12 giorni il campo «Data» del file resta la data del pagamento e nella causale non viene scritta nessun'altra data. Se per le tardive il commercialista vuole un'altra data, o una data nella causale, va detto prima di trasmettere.",
];

/** Una riga per fattura emessa, per numerazione: pronta da girare al commercialista. Le bozze non ci sono.
 *  Con `azienda` ogni riga porta anche il totale che dirà il file XML (`totaleNelFile`). */
export function righeRiepilogoCommercialista(fatture: Fattura[], azienda?: DatiAzienda): RigaRiepilogoCommercialista[] {
  return fatture
    .filter((f) => f.stato === "emessa")
    .sort((a, b) => a.anno - b.anno || a.serie.localeCompare(b.serie) || a.numero - b.numero)
    .map((f) => {
      const giorno = f.dataPagamento || f.data;
      return {
        numero: etichettaNumero(f),
        data: f.data,
        cliente: f.cliente.azienda ? f.cliente.denominazione : `${f.cliente.nome} ${f.cliente.cognome}`.trim(),
        codiceFiscale: f.cliente.codiceFiscale,
        imponibile: f.imponibile,
        iva: f.imposta,
        totale: f.totale,
        totaleNelFile: azienda ? totaleNelFile(f, azienda) : null,
        modo: modoDi(f.metodoPagamento).titolo,
        riferimento: f.riferimentoPagamento ?? "",
        meseCompetenza: giorno.slice(0, 7),
        ultimoGiornoUtile: ultimoGiornoUtile(giorno),
      };
    });
}
