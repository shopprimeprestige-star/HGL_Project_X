/** ── IL PACCHETTO DA MANDARE AL COMMERCIALISTA ─────────────────────────────
 *
 *  Richiesta del committente: un file solo, da allegare a una mail, con dentro
 *  tutto quello che serve per la dichiarazione — gli originali di Meta e degli
 *  altri, gli elenchi, e il riepilogo dei conti.
 *
 *  ── COSA CI VA DENTRO, E PERCHÉ PROPRIO QUELLO ────────────────────────────
 *   · `originali/ricevute/`  i file come sono arrivati: l'XML dello SDI, il
 *     PDF di Meta con la sua grafica. Sono LORO a fare fede in una verifica,
 *     non i nostri elenchi.
 *   · `originali/emesse/`    l'XML delle nostre fatture, ricostruito dal
 *     tracciato: è quello che è passato — o che deve passare — dallo SDI.
 *   · `fatture-ricevute.csv` e `fatture-emesse.csv`: per leggere in fretta e
 *     per fare le somme in un foglio di calcolo.
 *   · `da-trasmettere-allo-sdi.csv`: le sole fatture estere, con accanto il
 *     tipo documento (TD17, TD18, TD19) e la data entro cui va trasmesso. È il
 *     foglio che risponde alla domanda che il commercialista fa sempre —
 *     «degli esteri cosa mi manca?» — senza che nessuno debba rileggere le
 *     fatture una per una.
 *   · `riepilogo.html`: il conto del periodo, con le regole applicate.
 *   · `LEGGIMI.txt`: cosa c'è dentro, e cosa NON c'è.
 *
 *  ── ⚠️ QUELLO CHE NON C'È, E VA DETTO ─────────────────────────────────────
 *  Un pacchetto che sembra completo e non lo è fa più danno di uno palesemente
 *  parziale, perché nessuno va a cercare quello che crede di avere già.
 *  Dentro non ci sono: gli estratti conto, le buste paga, i documenti
 *  doganali che non siano stati caricati qui, gli F24 pagati, i libri sociali.
 *  Il LEGGIMI li elenca uno per uno.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { Fattura } from "./fatture/tipi";
import type { DatiAzienda } from "./fatture/tipi";
import { costruisciXml, nomeFileXml } from "./fatture/xml";
import { costruisciFoglio } from "./contabilita-foglio";
import { costruisciFoglioF24 } from "./contabilita-f24-foglio";
import { protocolli } from "./contabilita-registri";
import { costruisciRegistri } from "./contabilita-registri-foglio";
import {
  costruisciAutofattura,
  nomeFileAutofattura,
  problemiAutofattura,
} from "./contabilita-autofattura";
import { righeF24 } from "./contabilita-f24";
import { componiZip, csv, daBase64, nomeLibero } from "./contabilita-pacchetto";
import { adempimento, regimeDi } from "./contabilita-regimi";
import { effettiContabili, leggiAllegato, type FatturaFornitore } from "./contabilita-fornitori";
import { primoGiornoUtile } from "./contabilita-scadenze";
import type { Aliquote, ContoFiscale } from "./contabilita";
import type { RegoleContabili } from "./contabilita-regole";
import type { Periodo } from "./contabilita-periodo";

const byte = (s: string) => new TextEncoder().encode(s);

/** «1 fattura» / «3 fatture». Un LEGGIMI che dice «1 documenti» lo legge
 *  qualcuno che non lavora qui dentro, e la prima impressione di un documento
 *  è se è stato riletto da qualcuno. */
const plur = (n: number, uno: string, molti: string) => `${n} ${n === 1 ? uno : molti}`;

/** Entro quando va trasmesso allo SDI il documento di una fattura estera:
 *  il 15 del mese SUCCESSIVO a quello in cui è stata ricevuta. */
export function entroQuando(dataFattura: string): string {
  const a = Number(dataFattura.slice(0, 4));
  const m = Number(dataFattura.slice(5, 7));
  const dopo = m === 12 ? { a: a + 1, m: 1 } : { a, m: m + 1 };
  return primoGiornoUtile(`${dopo.a}-${String(dopo.m).padStart(2, "0")}-15`);
}

export async function costruisciPacchetto(opzioni: {
  periodo: Periodo;
  azienda: DatiAzienda;
  fatture: Fattura[];
  fornitori: FatturaFornitore[];
  /** Come si liquida l'IVA: serve al prospetto F24, che senza non sa quale
   *  codice tributo scrivere. Assente = trimestrale, come dappertutto. */
  liquidazione?: "mensile" | "trimestrale";
  conto: ContoFiscale;
  aliquote: Aliquote;
  regole: RegoleContabili;
  /** Tutte le fatture ricevute, non solo quelle del periodo: i protocolli del
   *  registro degli acquisti sono progressivi sull'anno intero. */
  tutteLeRicevute?: FatturaFornitore[];
  /** Detto a ogni file, per non lasciare la pagina muta su cento allegati. */
  avanzamento?: (fatti: number, totale: number) => void;
}): Promise<{ zip: Blob; nome: string; dentro: number; senzaOriginale: string[] }> {
  const { periodo, azienda, fatture, fornitori, conto, aliquote, regole } = opzioni;
  const usati = new Set<string>();
  const voci: { nome: string; dati: Uint8Array; quando: Date }[] = [];
  const senzaOriginale: string[] = [];
  const quando = (d: string) => new Date(`${d || "2000-01-01"}T12:00:00`);

  /* ── GLI ORIGINALI DELLE FATTURE RICEVUTE ────────────────────────────── */
  const totale = fornitori.length;
  for (let i = 0; i < fornitori.length; i++) {
    const f = fornitori[i];
    opzioni.avanzamento?.(i, totale);
    const base = `${f.data} ${f.notaDiCredito ? "NC " : ""}${f.fornitore}${f.numero ? ` n.${f.numero}` : ""}`;

    /*  ── LA PROVA DI PAGAMENTO, IN UNA CARTELLA SUA ──────────────────────
        ⚠️ Prima di tutto il resto perché sotto ci sono dei `continue`: messa
        dopo, sarebbe finita nello zip solo per le fatture senza documento —
        cioè esattamente quelle che una prova di pagamento non ce l'hanno.
        ⚠️ E in «pagamenti/» e non fra le ricevute: al commercialista servono
        separate. Una ricevuta PayPal in mezzo alle fatture si legge come una
        fattura, e su un acquisto estero è l'equivoco che porta a registrare
        due volte lo stesso costo. */
    if (f.conProvaPagamento) {
      const pg = await leggiAllegato(f.id, "pagamento").catch(() => null);
      if (pg?.contenuto) {
        const est = /pdf/i.test(pg.tipo || pg.nome) ? "pdf" : (pg.nome.split(".").pop() ?? "bin");
        voci.push({
          nome: nomeLibero(usati, `pagamenti/${base}.${est}`),
          dati: daBase64(pg.contenuto),
          quando: quando(f.data),
        });
      }
    }

    /*  ── LA BOLLETTA DOGANALE, IN UNA CARTELLA SUA ──────────────────────
        ⚠️ Separata dalle fatture e dai pagamenti perché il commercialista la
        cerca per fare una cosa diversa: da lì detrae l'IVA all'importazione,
        che nella fattura del fornitore non c'è. Confusa fra le ricevute
        resta un allegato qualunque, e quell'imposta non la riprende nessuno. */
    if (f.conBollettaDoganale) {
      const bd = await leggiAllegato(f.id, "dogana").catch(() => null);
      if (bd?.contenuto) {
        const est = /pdf/i.test(bd.tipo || bd.nome) ? "pdf" : (bd.nome.split(".").pop() ?? "bin");
        voci.push({
          nome: nomeLibero(usati, `dogana/${base}.${est}`),
          dati: daBase64(bd.contenuto),
          quando: quando(f.data),
        });
      }
    }

    if (f.originale) {
      voci.push({
        nome: nomeLibero(usati, `originali/ricevute/${base}.xml`),
        dati: byte(f.originale),
        quando: quando(f.data),
      });
      continue;
    }
    if (f.conAllegato) {
      //  ⚠️ L'allegato sta in una chiave sua e si va a prendere solo adesso:
      //   l'elenco delle fatture si legge a ogni apertura della pagina, e
      //   tenerci dentro i PDF vorrebbe dire scaricare dei megabyte per
      //   mostrare delle righe di testo.
      const a = await leggiAllegato(f.id).catch(() => null);
      if (a?.contenuto) {
        const est = /pdf/i.test(a.tipo || a.nome) ? "pdf" : (a.nome.split(".").pop() ?? "bin");
        voci.push({
          nome: nomeLibero(usati, `originali/ricevute/${base}.${est}`),
          dati: daBase64(a.contenuto),
          quando: quando(f.data),
        });
        continue;
      }
    }
    //  ⚠️ SI DICE QUALI NON HANNO UN FILE. Una fattura scritta a mano senza
    //   documento allegato è un costo che in una verifica non si può
    //   dimostrare: lasciarla sparire dentro un elenco vorrebbe dire scoprirlo
    //   il giorno sbagliato.
    senzaOriginale.push(`${f.fornitore} · ${f.data}${f.numero ? ` · n. ${f.numero}` : ""}`);
  }

  /* ── L'XML DELLE NOSTRE ─────────────────────────────────────────────── */
  for (const f of fatture) {
    try {
      voci.push({
        nome: nomeLibero(usati, `originali/emesse/${nomeFileXml(f, azienda)}`),
        dati: byte(costruisciXml(f, azienda)),
        quando: quando(f.data),
      });
    } catch {
      /*  ⚠️ Una fattura che non si riesce a mettere in XML NON ferma il
          pacchetto: dei dati mancanti nell'anagrafica di un cliente
          renderebbero impossibile scaricare qualunque cosa, proprio nel giorno
          in cui serve. Resta comunque nell'elenco CSV, dove si vede. */
      senzaOriginale.push(`nostra fattura n. ${f.numero}/${f.anno}: XML non generabile`);
    }
  }

  /* ── ⚠️ LE AUTOFATTURE, PRONTE DA TRASMETTERE ────────────────────────
     Fino a ieri il pacchetto diceva al commercialista QUALI documenti
     mandare, e lui li batteva a mano uno per uno. Adesso ci sono dentro: un
     file per ogni acquisto estero, nel formato dello SDI, in una cartella che
     si chiama come il gesto che ci si deve fare.
     ⚠️ Quelle che non si possono costruire NON si costruiscono a metà: si
      elencano nel LEGGIMI con il motivo. Un file incompleto trasmesso torna
      indietro con un codice e nessuna spiegazione. */
  const autofattureRotte: string[] = [];
  for (const f of fornitori) {
    if (!regimeDi(f.regime ?? "italiana").tipoDocumento) continue;
    const problemi = problemiAutofattura(f, azienda);
    if (problemi.length > 0) {
      autofattureRotte.push(`${f.fornitore} · ${f.data}: ${problemi.join("; ")}`);
      continue;
    }
    try {
      voci.push({
        nome: nomeLibero(usati, `da-trasmettere-allo-sdi/${nomeFileAutofattura(f, azienda)}`),
        dati: byte(costruisciAutofattura(f, azienda)),
        quando: quando(f.data),
      });
    } catch {
      autofattureRotte.push(`${f.fornitore} · ${f.data}: il file non si è potuto costruire`);
    }
  }

  /* ── GLI ELENCHI ────────────────────────────────────────────────────── */
  voci.push({
    nome: "fatture-emesse.csv",
    dati: byte(
      csv([
        [
          "Numero",
          "Serie",
          "Data",
          "Cliente",
          "P.IVA / CF",
          "Imponibile",
          "IVA",
          "Totale",
          "Stato",
          "Pagata il",
        ],
        ...fatture.map((f) => [
          f.numero,
          f.serie ?? "",
          f.data,
          f.cliente.azienda
            ? f.cliente.denominazione
            : `${f.cliente.nome} ${f.cliente.cognome}`.trim(),
          f.cliente.partitaIva || f.cliente.codiceFiscale,
          f.imponibile,
          f.imposta,
          f.totale,
          f.stato,
          f.dataPagamento ?? "",
        ]),
      ]),
    ),
    quando: new Date(),
  });

  voci.push({
    nome: "fatture-ricevute.csv",
    dati: byte(
      csv([
        [
          "Data",
          "Fornitore",
          "Paese",
          "Numero",
          "Regime",
          "Imponibile",
          "IVA in fattura",
          "IVA da autoliquidare",
          "Costo",
          "Documento",
          "Adempimento",
        ],
        ...fornitori.map((f) => {
          const e = effettiContabili(f);
          const r = regimeDi(f.regime ?? "italiana");
          return [
            f.data,
            f.fornitore,
            f.partitaIva,
            f.paese ?? "",
            f.numero,
            //  ⚠️ Scritto in chiaro nell'elenco: nel CSV gli importi della
            //   colonna «Costo» sono già negativi, e una riga negativa senza
            //   una parola accanto sembra un errore di esportazione.
            f.notaDiCredito ? "NOTA DI CREDITO" : "fattura",
            f.righe
              .map((x) => x.descrizione)
              .filter(Boolean)
              .join(" · "),
            r.titolo,
            f.imponibile,
            e.ivaDetraibile,
            e.ivaAutoliquidata,
            e.costo,
            f.originale ? "XML" : f.conAllegato ? "PDF allegato" : "NESSUNO",
            e.bloccato || adempimento(f.regime ?? "italiana"),
          ];
        }),
      ]),
    ),
    quando: new Date(),
  });

  /* ── ⚠️ IL FOGLIO DEGLI ESTERI, CHE È QUELLO CHE SI PERDE ───────────── */
  const esteri = fornitori.filter((f) => regimeDi(f.regime ?? "italiana").tipoDocumento);
  if (esteri.length > 0) {
    voci.push({
      nome: "da-trasmettere-allo-sdi.csv",
      dati: byte(
        csv([
          [
            "Data documento",
            "Fornitore",
            "Paese",
            "Tipo documento",
            "Imponibile",
            "Aliquota",
            "IVA da autoliquidare",
            "Da trasmettere entro",
            "INTRASTAT",
          ],
          ...esteri.map((f) => {
            const r = regimeDi(f.regime ?? "italiana");
            const e = effettiContabili(f);
            return [
              f.data,
              f.fornitore,
              f.paese ?? "",
              r.tipoDocumento,
              f.imponibile,
              `${Number(f.aliquotaReverse) || 22}%`,
              e.ivaAutoliquidata,
              entroQuando(f.data),
              r.intrastat ? `sì, ${r.intrastat} (sopra le soglie)` : "no",
            ];
          }),
        ]),
      ),
      quando: new Date(),
    });
  }

  /*  ── IL PROSPETTO F24 ────────────────────────────────────────────────
      Solo quando c'è qualcosa da versare: un foglio che dice «non devi
      niente» dentro un pacchetto è una pagina in più da sfogliare. */
  const liquidazione = opzioni.liquidazione ?? "trimestrale";
  if (righeF24(conto, periodo, liquidazione).length > 0) {
    voci.push({
      nome: "f24-cosa-scrivere.html",
      dati: byte(
        costruisciFoglioF24(
          conto,
          periodo,
          liquidazione,
          azienda,
          new Date().toISOString().slice(0, 10),
        ),
      ),
      quando: new Date(),
    });
  }

  /*  ── I REGISTRI IVA ──────────────────────────────────────────────────
      Sono libri obbligatori (artt. 23 e 25 DPR 633/72): in una verifica si
      chiedono quelli, non gli elenchi. ⚠️ I protocolli si numerano su TUTTO
      l'archivio, non sul periodo — un progressivo che riparte a ogni trimestre
      non e' un progressivo. */
  voci.push({
    nome: "registri-iva.html",
    dati: byte(
      costruisciRegistri(
        fatture,
        fornitori,
        protocolli(opzioni.tutteLeRicevute ?? fornitori),
        periodo,
        azienda,
      ),
    ),
    quando: new Date(),
  });

  /*  ── LE AUTOFATTURE PRONTE DA TRASMETTERE ────────────────────────────
      Un file per ogni acquisto estero. Quelle che non si costruiscono sono
      gia' elencate nel LEGGIMI: qui entrano solo quelle buone. */
  for (const f of fornitori) {
    if (problemiAutofattura(f, azienda).length > 0) continue;
    voci.push({
      nome: nomeLibero(usati, `da-trasmettere/${nomeFileAutofattura(f, azienda)}`),
      dati: byte(costruisciAutofattura(f, azienda)),
      quando: quando(f.data),
    });
  }

  /* ── IL RIEPILOGO ───────────────────────────────────────────────────── */
  voci.push({
    nome: "riepilogo.html",
    dati: byte(costruisciFoglio(conto, aliquote, periodo, azienda, regole)),
    quando: new Date(),
  });

  /* ── IL LEGGIMI ─────────────────────────────────────────────────────── */
  const doganali = fornitori.filter((f) => regimeDi(f.regime ?? "italiana").inDogana);
  /*  ── ⚠️ LE IMPORTAZIONI SENZA LA BOLLETTA ────────────────────────────────
      Non «quante importazioni ci sono» — QUALI non hanno il documento con cui
      si detrae l'imposta. È la differenza fra un promemoria che si legge e si
      dimentica e una lista di telefonate da fare al corriere. Su ognuna di
      queste righe c'è dell'IVA che nessuno sta riprendendo, e la si scopre
      solo se qualcuno la nomina. */
  const pagamenti = fornitori.filter((f) => f.conProvaPagamento).length;
  const inDogana = fornitori.filter((f) => f.conBollettaDoganale).length;
  const doganaliScoperte = doganali
    .filter((f) => !f.conBollettaDoganale)
    .map((f) => `${f.fornitore} · ${f.data}${f.numero ? ` · n. ${f.numero}` : ""}`);
  const daPrecisare = fornitori.filter((f) => regimeDi(f.regime ?? "italiana").daPrecisare);
  const leggimi = [
    `CONTABILITÀ ${azienda.denominazione || ""} — ${periodo.nome}`,
    `Generato dal CRM il ${new Date().toLocaleDateString("it-IT")}.`,
    "",
    "COSA C'È DENTRO",
    `· originali/ricevute/ — ${plur(fornitori.length - senzaOriginale.length, "documento", "documenti")} come sono arrivati (XML dello SDI e PDF dei fornitori esteri).`,
    fatture.length
      ? `· originali/emesse/ — l'XML delle ${plur(fatture.length, "fattura emessa", "fatture emesse")} nel periodo.`
      : "· nessuna fattura emessa in questo periodo.",
    /*  ⚠️ Le due cartelle nuove si NOMINANO nel LEGGIMI, con scritto a cosa
        servono. Uno zip che contiene una cartella «dogana» senza spiegarla la
        fa aprire per curiosità e chiudere subito: quei file valgono soldi, e
        chi li riceve deve sapere perché stanno separati. */
    pagamenti > 0
      ? `· pagamenti/ — ${plur(pagamenti, "ricevuta", "ricevute")} di pagamento (PayPal, bonifici). Dimostrano che i soldi sono usciti; NON sono fatture e non si registrano.`
      : "",
    inDogana > 0
      ? `· dogana/ — ${plur(inDogana, "bolletta doganale", "bollette doganali")}. È DA QUI che si detrae l'IVA all'importazione, non dalla fattura del fornitore: ognuna va registrata come documento a sé, con l'IVA esposta.`
      : "",
    "· fatture-emesse.csv e fatture-ricevute.csv — gli elenchi, separati da punto e virgola, apribili con Excel.",
    esteri.length
      ? `· da-trasmettere-allo-sdi.csv — ${plur(esteri.length, "la fattura estera", "le fatture estere")} con il tipo documento (TD17/TD18/TD19) e la data entro cui va trasmesso.`
      : "· nessuna fattura estera in questo periodo.",
    "· registri-iva.html — i registri delle fatture emesse e degli acquisti (artt. 23 e 25 DPR 633/72), con i numeri di protocollo.",
    "· da-trasmettere/ — le autofatture TD17/TD18/TD19 gia' pronte, un file per ogni acquisto estero.",
    "· riepilogo.html — il conto del periodo: IVA, costi deducibili e non, imposte stimate.",
    righeF24(conto, periodo, opzioni.liquidazione ?? "trimestrale").length > 0
      ? "· f24-cosa-scrivere.html — codice tributo, periodo, anno e importo del versamento IVA. NON e' un modello F24 e non si puo' presentare: una societa' con partita IVA versa per via telematica."
      : "",
    esteri.length
      ? `· da-trasmettere-allo-sdi/ — le autofatture e le integrazioni gia' pronte (TD17/TD18/TD19), una per ogni acquisto estero. Vanno trasmesse dal canale telematico dello studio; il numero e' di un sezionale «AF» e si puo' cambiare prima dell'invio.`
      : "",
    "",
    "COSA NON C'È, E VA RECUPERATO ALTROVE",
    "· gli estratti conto bancari e le ricevute degli F24 pagati;",
    "· le buste paga e i contributi, se ci sono dipendenti;",
    "· i libri sociali e i verbali;",
    "· i documenti doganali delle importazioni che non sono stati caricati nel CRM;",
    "· i contratti (affitto, leasing, finanziamenti).",
    "",
    "DA GUARDARE",
    senzaOriginale.length
      ? `· ${plur(senzaOriginale.length, "riga non ha", "righe non hanno")} un documento allegato:\n  ${senzaOriginale.join("\n  ")}`
      : "· tutte le fatture ricevute hanno il loro documento.",
    autofattureRotte.length
      ? `· ${plur(autofattureRotte.length, "autofattura non si e' potuta costruire", "autofatture non si sono potute costruire")}:\n  ${autofattureRotte.join("\n  ")}`
      : "",
    daPrecisare.length
      ? `· ${plur(daPrecisare.length, "fattura è registrata", "fatture sono registrate")} con il vecchio «inversione contabile» generico: manca il tipo documento da trasmettere. Va riaperta e precisata (beni o servizi, UE o extra-UE).`
      : "",
    doganaliScoperte.length
      ? `· ${plur(doganaliScoperte.length, "importazione non ha", "importazioni non hanno")} la bolletta doganale allegata. Su quelle righe c'e' dell'IVA che nessuno sta detraendo: la bolletta la manda il corriere, e va poi REGISTRATA come documento a se' (con l'IVA esposta), non solo allegata.\n  ${doganaliScoperte.join("\n  ")}`
      : doganali.length
        ? `· ${plur(doganali.length, "importazione", "importazioni")}: l'IVA non si detrae da quelle fatture ma dal documento doganale, che e' allegato in dogana/ e va registrato a parte.`
        : "",
    "",
    "AVVERTENZA",
    "Le imposte del riepilogo sono una STIMA gestionale: non tengono conto di acconti versati,",
    "perdite riportate, ammortamenti e deducibilità parziali. Il conto vero è quello dello studio.",
  ]
    .filter((r) => r !== "")
    .join("\n");
  voci.push({ nome: "LEGGIMI.txt", dati: byte(leggimi), quando: new Date() });

  opzioni.avanzamento?.(totale, totale);
  const nome = `contabilita-${periodo.nome
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}.zip`;
  return { zip: componiZip(voci), nome, dentro: voci.length, senzaOriginale };
}
