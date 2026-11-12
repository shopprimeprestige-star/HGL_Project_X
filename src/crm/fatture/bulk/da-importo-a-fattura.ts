/** ── FATTURE BULK · LA FUNZIONE FISCALE ISOLATA (da-importo-a-fattura.ts) ──
 *  L'UNICO punto che trasforma «importo pagato + impostazioni del centro» in
 *  una fattura. Se il commercialista cambia una regola (VERIFICA-FISCALE.md,
 *  «Domande»), si cambia qui e in regole-lotto.ts, e da nessun'altra parte.
 *
 *  Le regole, una per una (NOTE-FISCALI R7-R19, VERIFICA-FISCALE 5-6):
 *   · l'importo letto è il LORDO pagato (IVA compresa): `contoDaLordo`, lo stesso
 *     conto di tutto il CRM, all'aliquota DEL CENTRO. Una riga, quantità 1.
 *   · tipo sempre «unica» (decisione del titolare): nessun acconto, nessun saldo.
 *   · data della fattura = data del pagamento letta. MAI «oggi».
 *   · modo di pagamento: solo quelli di `MODI_INCASSO`, mai un ripiego su bonifico.
 *     Il codice MP lo mette l'XML dal modo (bonifico MP05, pos e carta MP08,
 *     contanti MP01); PayPal e Satispay non sono nell'elenco e quindi si fermano.
 *   · descrizione: solo quelle di `descrizioni.ts`, neutre (niente salute, né
 *     detrazione, né articoli di legge: VERIFICA-FISCALE punto 7).
 *   · aliquota 0 = non si fattura: senza IVA servirebbe il bollo da 2 € oltre
 *     77,47 € e il CRM non lo sa fare (R4, confermato dalla guida AdE).
 *
 *  ⚠️ CHI LA CHIAMA (T10): solo con importo, data e modo validi, altrimenti
 *   LANCIA. Per i dati del cliente mancanti (CAP, CF…) invece NON lancia: la
 *   fattura simulata esce lo stesso e li trova `problemiXml` con il nome del campo.
 *  ⚠️ NON TOCCA xml.ts. Il difetto del centesimo (l'XML ricalcola l'IVA e su
 *   circa 1 importo su 5 scrive 104,01 invece di 104,00) resta com'è: lo si
 *   mostra con `avvisoTotaleXml` (R10); correggerlo è decisione del titolare. */
import { numeroScritto } from "../archivio";
import { contoDaLordo } from "../conti";
import { DESCRIZIONI } from "../descrizioni";
import { MODI_INCASSO, causaleSuggerita } from "../modi-di-incasso";
import { CLIENTE_VUOTO, type DatiAzienda, type Fattura } from "../tipi";
import { costruisciXml } from "../xml";
import { GIORNI_TERMINE_SDI } from "./chiavi";
import type { CampiRiga, Motivo } from "./tipi";

export interface IngressoFatturaDaRiga {
  campi: CampiRiga;
  azienda: DatiAzienda;
  lotto: string;
  idRiga: string;
  /** Vuota = la prima di `DESCRIZIONI`. Altrimenti una di quelle, identica. */
  descrizione: string;
  /** Scheda abbinata; null → `leadId` sintetico `bulk:<lotto>:<idRiga>`, mai vuoto (D5). */
  leadId: string | null;
  /** Numero provvisorio per la simulazione; il vero lo dà l'emissione. */
  numeroProvvisorio: number;
  /** Impronte dei file della riga (solo hash). */
  impronte: string[];
  /** Il tipo non si sceglie: se arriva diverso da «unica» è un errore di chi chiama (D3). */
  tipo?: "unica" | "acconto" | "saldo";
  /** «Adesso» per `creataIl`: lo si passa per avere una funzione deterministica; assente = l'orologio. */
  adesso?: string;
}

const eur = (n: number) => n.toFixed(2).replace(".", ",");

/** Una data AAAA-MM-GG che esiste davvero (29/02/2028 sì, 29/02/2027 no). */
function dataReale(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === s;
}

/** La descrizione va bene se è vuota (si usa la predefinita) o è una di quelle pronte. */
export const descrizioneAmmessa = (testo: string): boolean =>
  !String(testo ?? "").trim() || DESCRIZIONI.includes(String(testo).trim());

/** Un ingresso che non si può fatturare. Dichiarata `never` come funzione, così TypeScript restringe i tipi dopo ogni controllo. */
function rifiuta(perche: string): never {
  throw new Error(`fatturaDaRiga: ${perche}`);
}

/** Una `Fattura` «unica», una riga, con `origineBulk`. Rifiuta acconto/saldo e tutto ciò che non si può fatturare. */
export function fatturaDaRiga(i: IngressoFatturaDaRiga): Fattura {
  const c = i.campi;
  if (i.tipo !== undefined && i.tipo !== "unica")
    rifiuta("il tipo è sempre «unica»: il caricamento non fa acconti né saldi");
  if (!String(i.lotto ?? "").trim() || !String(i.idRiga ?? "").trim())
    rifiuta("mancano il lotto o la riga");
  if (!Number.isInteger(i.numeroProvvisorio) || i.numeroProvvisorio < 1)
    rifiuta("il numero provvisorio deve essere un intero positivo");

  const aliquota = Number(i.azienda.aliquotaPredefinita);
  if (!(aliquota > 0))
    rifiuta(
      "l'aliquota IVA del centro è zero o non valida: il lotto è bloccato (bollo non gestito)",
    );

  const importo = c.importo;
  if (typeof importo !== "number" || !Number.isFinite(importo) || importo <= 0)
    rifiuta("importo mancante o non positivo");
  // Niente arrotondamenti silenziosi sui soldi: più di due decimali è una lettura sbagliata, la corregge una persona.
  if (Math.abs(importo * 100 - Math.round(importo * 100)) > 1e-6)
    rifiuta("l'importo ha più di due decimali");
  if (!dataReale(c.data)) rifiuta("la data del pagamento manca o non esiste");
  // Il modo viene dalla configurazione esistente: PayPal, Satispay e il resto non ci sono e si fermano qui.
  if (!MODI_INCASSO.some((m) => m.chiave === c.modo))
    rifiuta("il modo di pagamento manca o non è fra quelli gestiti");

  const descrizione = String(i.descrizione ?? "").trim() || DESCRIZIONI[0];
  if (!DESCRIZIONI.includes(descrizione))
    rifiuta("la descrizione non è fra quelle pronte (devono restare neutre)");

  const conto = contoDaLordo(importo, aliquota);
  const anno = Number(c.data.slice(0, 4));
  const riferimento = String(c.riferimento ?? "").trim();
  const nome = String(c.nome ?? "").trim();
  const cognome = String(c.cognome ?? "").trim();
  const leadId = String(i.leadId ?? "").trim() || `bulk:${i.lotto}:${i.idRiga}`;

  return {
    id: `${anno}-${numeroScritto(i.numeroProvvisorio)}`,
    stato: "emessa",
    numero: i.numeroProvvisorio,
    anno,
    serie: i.azienda.serie || "",
    // La data del pagamento, e basta: è anche la data del documento (emettiSu la riscrive uguale).
    data: c.data,
    dataPagamento: c.data,
    tipo: "unica",
    leadId,
    leadNome: `${nome} ${cognome}`.trim(),
    preventivoRef: "",
    cliente: {
      ...CLIENTE_VUOTO,
      azienda: false,
      nome,
      cognome,
      codiceFiscale: String(c.codiceFiscale ?? "")
        .replace(/\s+/g, "")
        .toUpperCase(),
      // Via e civico stanno insieme nell'indirizzo, come negli altri flussi.
      indirizzo: String(c.indirizzo ?? "").trim(),
      civico: "",
      cap: String(c.cap ?? "").trim(),
      comune: String(c.comune ?? "").trim(),
      provincia: String(c.provincia ?? "").trim(),
      nazione: "IT",
      codiceDestinatario: "0000000",
      pec: "",
    },
    righe: [
      { descrizione, quantita: 1, prezzoUnitario: conto.imponibile, aliquota: conto.aliquota },
    ],
    causale: causaleSuggerita({ metodo: c.modo || null, base: descrizione, riferimento }),
    imponibile: conto.imponibile,
    imposta: conto.imposta,
    totale: conto.totale,
    creataIl: i.adesso ?? new Date().toISOString(),
    emessaIl: "",
    metodoPagamento: c.modo || undefined,
    riferimentoPagamento: riferimento,
    origineBulk: {
      lotto: i.lotto,
      riga: i.idRiga,
      impronte: [...i.impronte],
      ...(riferimento ? { riferimento } : {}),
    },
  };
}

/** Il totale che finirebbe nell'XML (dal testo di `costruisciXml`, senza toccare xml.ts): per l'avviso R10. */
export function totaleNelFile(f: Fattura, azienda: DatiAzienda): number {
  const m = /<ImportoTotaleDocumento>(-?\d+(?:\.\d+)?)<\/ImportoTotaleDocumento>/.exec(
    costruisciXml(f, azienda),
  );
  if (!m) throw new Error("totaleNelFile: l'XML non ha l'importo totale del documento");
  return Number(m[1]);
}

/** R10: se il file dice un totale diverso dal pagato (di un centesimo, per il ricalcolo dell'IVA in xml.ts) lo si segnala. Non ferma niente. */
export function avvisoTotaleXml(f: Fattura, azienda: DatiAzienda): Motivo | null {
  const nelFile = totaleNelFile(f, azienda);
  if (Math.round(nelFile * 100) === Math.round(f.totale * 100)) return null;
  return {
    codice: "totale_xml_diverso",
    gravita: "avviso",
    testo: `Nel file XML il totale sarà ${eur(nelFile)}, il cliente ha pagato ${eur(f.totale)}: il file ricalcola l'IVA e può scostarsi di un centesimo (lo SdI tollera ±1 centesimo).`,
  };
}

/** Data + 12 giorni di calendario (stima, D1/D15): il termine finisce all'invio allo SdI, non alla numerazione nel CRM.
 *  Data non valida → "" (è solo una scritta in anteprima, non deve rompere la riga). */
export function ultimoGiornoUtile(data: string): string {
  if (!dataReale(data)) return "";
  const [a, m, g] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, g + GIORNI_TERMINE_SDI)).toISOString().slice(0, 10);
}
