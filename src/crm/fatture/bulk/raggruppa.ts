/** ── FATTURE BULK · RAGGRUPPAMENTO E RICOMPOSIZIONE (raggruppa.ts) ──
 *  Funzioni pure, nessun dato di persona: lavorano sul solo TIPO di ogni file,
 *  che sopravvive alla pulizia dei dati dopo l'emissione (D11b). Per questo
 *  `ricomponi` dà gli stessi `idRiga` prima e dopo lo svuotamento delle letture.
 *
 *  ⚠️ Il raggruppamento per posizione («tre alla volta») sarebbe sbagliato per
 *   sempre dopo un solo file mancante: tutti i clienti seguenti avrebbero
 *   l'indirizzo di uno e il pagamento di un altro. Qui il cliente finisce
 *   quando arriva un tipo già presente (o quando i file sono tre), così un
 *   buco si vede (riga incompleta) e i clienti dopo restano interi. */
import { idRigaDa, MAX_FILE } from "./chiavi";
import type { FileLotto, GruppoRicomposto, TipoFile } from "./tipi";

export type CriterioOrdine = "nome" | "data";

/** «Screenshot 2» prima di «Screenshot 10»; le maiuscole non contano. */
const confrontaNomi = new Intl.Collator("it", { numeric: true, sensitivity: "base" }).compare;

/** Ordine naturale dei nomi, a parità la data del file; oppure per data, a parità il nome.
 *  Non muta l'input. */
export function ordinaFile<T extends { nome: string; modificatoIl: number }>(file: T[], criterio: CriterioOrdine): T[] {
  const perNome = (a: T, b: T) => confrontaNomi(a.nome, b.nome) || a.modificatoIl - b.modificatoIl;
  const perData = (a: T, b: T) => a.modificatoIl - b.modificatoIl || confrontaNomi(a.nome, b.nome);
  return [...file].sort(criterio === "data" ? perData : perNome);
}

export interface ConteggioGruppi {
  file: number;
  /** Terne complete. */
  gruppiCompleti: number;
  /** File che avanzano (n mod 3). */
  fileInPiu: number;
  /** Clienti previsti («300 file → 100 clienti»): solo le terne complete; i file in più sono a parte. */
  clienti: number;
  /** Più di MAX_FILE: da rifiutare. */
  oltreIlLimite: boolean;
}

export function contaGruppi(n: number): ConteggioGruppi {
  if (!Number.isInteger(n) || n < 0) throw new Error("il numero di file deve essere un intero, zero o più");
  const gruppiCompleti = Math.floor(n / 3);
  return { file: n, gruppiCompleti, fileInPiu: n % 3, clienti: gruppiCompleti, oltreIlLimite: n > MAX_FILE };
}

/** I tre tipi di un cliente, nell'ordine «solito» (indirizzo, tessera, pagamento). */
const TIPI_CLIENTE: TipoFile[] = ["indirizzo", "tessera", "pagamento"];

/** I file di un lotto come li vuole `ricomponi`: browser, rotta ed emissione passano di qui, così ricompongono
 *  allo stesso modo (stessi `idRiga`). `fallito` = lettura in errore, oppure file già chiuso (emesso o scartato)
 *  che non ha mai avuto un tipo: la pulizia dei dati toglie lo stato «errore» ma non deve far sparire il cliente. */
export function tipiPerRicomporre(
  file: Iterable<Pick<FileLotto, "indice" | "stato" | "tipo">>,
): { indice: number; tipo: TipoFile; fallito: boolean }[] {
  return [...file].map((f) => ({
    indice: f.indice,
    tipo: (f.tipo || "altro") as TipoFile,
    fallito: f.stato === "errore" || ((f.stato === "emessa" || f.stato === "scartata") && !f.tipo),
  }));
}

/** Ricompone i clienti dai tipi: un cliente finisce quando arriva un tipo già presente
 *  o quando ha tre file. «altro» (illeggibile) occupa il suo posto senza contare come tipo;
 *  un gruppo fatto di soli «altro» non è un cliente, SALVO che un suo file sia `fallito` (la lettura è
 *  fallita, o il file è stato chiuso senza mai essere letto): un cliente non sparisce mai, la riga c'è,
 *  incompleta, e dice di premere «Rileggi». I file si ordinano per `indice`.
 *  ⚠️ Un file in più (non letto bene, screenshot estraneo) sposta di uno i clienti seguenti, come ogni
 *   file mancante: le righe restano incomplete o con l'ordine diverso, mai «a posto» per caso. */
export function ricomponi(
  file: { indice: number; tipo: TipoFile; fallito?: boolean }[],
): GruppoRicomposto[] {
  const ordinati = [...file].sort((a, b) => a.indice - b.indice);
  for (let i = 1; i < ordinati.length; i += 1)
    if (ordinati[i].indice === ordinati[i - 1].indice) throw new Error(`indice ${ordinati[i].indice} ripetuto: i file del lotto sono rovinati`);

  /** Un file non ancora letto (tipo vuoto o sconosciuto) vale «altro»: la riga resta incompleta, mai pronta. */
  const tipoDi = (t: string): TipoFile => (TIPI_CLIENTE.includes(t as TipoFile) ? (t as TipoFile) : "altro");

  const gruppi: { indici: number[]; tipi: TipoFile[]; fallito: boolean }[] = [];
  let aperto: { indici: number[]; tipi: TipoFile[]; fallito: boolean } | null = null;
  ordinati.forEach((f) => {
    const tipo = tipoDi(f.tipo);
    if (aperto && (aperto.indici.length >= 3 || (tipo !== "altro" && aperto.tipi.includes(tipo)))) aperto = null;
    if (!aperto) {
      aperto = { indici: [], tipi: [], fallito: false };
      gruppi.push(aperto);
    }
    aperto.indici.push(f.indice);
    aperto.tipi.push(tipo);
    if (f.fallito) aperto.fallito = true;
  });

  return gruppi
    .filter((g) => g.fallito || g.tipi.some((t) => t !== "altro"))
    .map((g, k) => {
      const mancano = TIPI_CLIENTE.filter((t) => !g.tipi.includes(t));
      const presenti = g.tipi.filter((t) => t !== "altro");
      const { indici } = g;
      // Al suo posto = i file consecutivi di una terna che parte da un multiplo di 3; altrimenti è stata rimessa insieme dai tipi.
      // ⚠️ Si guarda l'INDICE del file (la sua posizione nel caricamento), non il posto nell'elenco passato.
      const alSuoPosto = indici.every((x, i) => x === indici[0] + i) && indici[0] % 3 === 0;
      return {
        idRiga: idRigaDa(indici),
        indici,
        numero: k + 1,
        tipi: g.tipi,
        ordineDiverso: mancano.length === 0 && presenti.join() !== TIPI_CLIENTE.join(),
        ricomposta: !alSuoPosto,
        incompleta: mancano.length > 0,
        mancano,
      };
    });
}
