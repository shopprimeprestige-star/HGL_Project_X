/** ── FATTURE BULK · L'ASSEMBLATORE (valuta.ts) ──────────────────────────────
 *  L'UNICO punto che compone le regole di una riga: file + letture + decisioni
 *  della persona + contesto (centro, fatture emesse, bozze, schede) → campi
 *  effettivi, fattura simulata, motivi, stato, `emettibile`. Funzioni pure,
 *  identiche nel browser (anteprima) e nel server (subito prima di emettere):
 *  se le due strade dessero un risultato diverso, il browser potrebbe far
 *  vedere «pronta» una riga che il server rifiuta, o peggio il contrario.
 *
 *  Compone: T2 (i gruppi li ha già fatti `ricomponi`), T3 `esaminaRiga`/`statoDi`,
 *  T4 `trovaDoppioni`/`abbinaScheda`, T5 `fatturaDaRiga`/`controllaLotto`, T7
 *  `esitoOrdineDate`/`fattiSulleDate`, e `problemiXml` sulla fattura simulata.
 *
 *  ── ⚠️ LE REGOLE CHE QUI SI FANNO RISPETTARE (dalle revisioni) ───────────────
 *   · «Pronto» c'è solo se `problemiXml` non ha bloccanti sulla fattura simulata:
 *     la stessa regola decide anteprima ed emissione. I bloccanti di `problemiXml`
 *     che le regole di riga già dicono (CAP, CF, nome…) non si ripetono; compaiono
 *     solo quelli che nessun altro ha visto (il CF omocodico, per ora).
 *   · Una riga NON è un doppione di se stessa: dalle `emesse` si toglie la fattura con lo
 *     stesso lotto e la stessa riga (ripresa dopo una risposta persa). Le righe già
 *     emesse o scartate non cercano doppioni, e non contano come «altre righe».
 *   · Nelle impronte della fattura (`origineBulk.impronte`) va SOLO quella del pagamento:
 *     tessera e indirizzo si ricaricano legittimamente per un secondo pagamento.
 *   · Un riferimento generico («BONIFICO», «PAGAMENTO», «RICARICA 2026»…) non vale per i
 *     doppioni: due clienti diversi lo avrebbero uguale e si bloccherebbero a vicenda.
 *   · Il centro (`controllaLotto`) si ricontrolla a ogni valutazione, quindi anche subito
 *     prima di ogni emissione (il server rilegge l'azienda e rivaluta), non solo all'apertura.
 *   · Il lotto si passa a `esitoOrdineDate` con la SERIE del centro, o un sezionale
 *     mescolerebbe le serie.
 *   · L'avviso del centesimo è uno solo: `avvisoTotaleXml` dice la stessa cosa dell'avviso
 *     «totale in archivio» di `problemiXml`, che quindi si scarta.
 *   · `esito: ""` (lo screenshot non lo dice, quasi sempre al POS) non blocca: lo fa solo
 *     `non_completato`. La conferma dei motivi è PER CODICE, quindi vale anche se cambiano i numeri.
 *   · Gli `indice` dei file sono le posizioni di caricamento e non si rinumerano mai: se
 *     si togliesse un file e si rinumerasse, tutte le righe dopo diventerebbero «ricomposta».
 *
 *  ⚠️ Quando serve vedere TUTTE le righe (i doppioni fra righe del lotto), chi valuta una riga
 *   sola — il server prima di emettere — passa `righePerDoppioni(tutteLeRighe, ctx)` come terzo
 *   argomento; `valutaLotto` lo fa da sé. Senza, la riga non vede le altre. */
import { cfValido } from "../../codice-fiscale";
import { leggiEuro } from "../../euro";
import { MODI_INCASSO, type MetodoPagamento } from "../modi-di-incasso";
import type { Fattura } from "../tipi";
import { problemiXml } from "../xml";
import {
  avvisoTotaleXml,
  descrizioneAmmessa,
  fatturaDaRiga,
  totaleNelFile,
  ultimoGiornoUtile,
} from "./da-importo-a-fattura";
import {
  abbinaScheda,
  cfDiversoDellaScheda,
  trovaDoppioni,
  type RigaPerDoppioni,
} from "./doppioni-e-schede";
import { cercaPerOrigine, esitoOrdineDate, fattiSulleDate } from "./emissione-bulk";
import { controllaLotto } from "./regole-lotto";
import { esaminaRiga, proponiData, statoDi } from "./regole-riga";
import type {
  CampiRiga,
  ContestoValutazione,
  DecisioniRiga,
  FattiSulleDate,
  FileLotto,
  GruppoRicomposto,
  IngressoRiga,
  LetturaIndirizzo,
  LetturaPagamento,
  LetturaTessera,
  Motivo,
  RigaValutata,
  StatoVisibile,
  ValutaRiga,
} from "./tipi";

/* ══ 1. LE LETTURE DI UNA RIGA ═════════════════════════════════════════════ */

interface LettureRiga {
  indirizzo?: LetturaIndirizzo;
  tessera?: LetturaTessera;
  pagamento?: LetturaPagamento;
  /** Impronta del file del pagamento: l'unica che conta per i doppioni. Vuota = non c'è. */
  improntaPagamento: string;
  /** I file del gruppo (per sapere se uno è fallito o non ancora letto). */
  file: FileLotto[];
}

/** Le letture dei file del gruppo. Un file «copia» di un altro già letto prende la lettura dell'originale
 *  ma tiene la PROPRIA impronta: è così che «screenshot già caricati» si riconosce. */
function lettureDel(gruppo: GruppoRicomposto, tutti: FileLotto[]): LettureRiga {
  const perIndice = new Map(tutti.map((f) => [f.indice, f] as const));
  const out: LettureRiga = { improntaPagamento: "", file: [] };
  for (const i of gruppo.indici) {
    const f = perIndice.get(i);
    if (!f) continue;
    out.file.push(f);
    const l =
      f.lettura ?? (f.copiaDi !== undefined ? perIndice.get(f.copiaDi)?.lettura : undefined);
    if (l?.tipo === "indirizzo" && !out.indirizzo) out.indirizzo = l;
    else if (l?.tipo === "tessera" && !out.tessera) out.tessera = l;
    else if (l?.tipo === "pagamento" && !out.pagamento) out.pagamento = l;
    if ((f.tipo === "pagamento" || l?.tipo === "pagamento") && !out.improntaPagamento)
      out.improntaPagamento = f.impronta;
  }
  return out;
}

/* ══ 2. I CAMPI EFFETTIVI (lettura + modifiche della persona) ══════════════ */

const CAMPI_VUOTI: CampiRiga = {
  nome: "",
  cognome: "",
  codiceFiscale: "",
  indirizzo: "",
  cap: "",
  comune: "",
  provincia: "",
  importo: null,
  data: "",
  modo: "",
  riferimento: "",
};

const testo = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

/** L'importo scritto a mano: un numero com'è, un testo («1.200,50») con `leggiEuro`; vuoto = mancante.
 *  Un testo senza cifre dà `null` (mancante), non zero. */
function importoDa(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = testo(v).trim();
  return /\d/.test(t) ? leggiEuro(t) : null;
}

function applicaModifiche(base: CampiRiga, m: Partial<CampiRiga> | undefined): CampiRiga {
  if (!m) return base;
  return {
    nome: m.nome !== undefined ? testo(m.nome) : base.nome,
    cognome: m.cognome !== undefined ? testo(m.cognome) : base.cognome,
    codiceFiscale: m.codiceFiscale !== undefined ? testo(m.codiceFiscale) : base.codiceFiscale,
    indirizzo: m.indirizzo !== undefined ? testo(m.indirizzo) : base.indirizzo,
    cap: m.cap !== undefined ? testo(m.cap) : base.cap,
    comune: m.comune !== undefined ? testo(m.comune) : base.comune,
    // La sigla scritta a mano in minuscolo («rm») è la stessa provincia: la regola vuole le maiuscole.
    provincia: m.provincia !== undefined ? testo(m.provincia).trim().toUpperCase() : base.provincia,
    importo: m.importo !== undefined ? importoDa(m.importo) : base.importo,
    data: m.data !== undefined ? testo(m.data) : base.data,
    modo: m.modo !== undefined ? (testo(m.modo) as CampiRiga["modo"]) : base.modo,
    riferimento: m.riferimento !== undefined ? testo(m.riferimento) : base.riferimento,
  };
}

const modoGestito = (modo: string): modo is MetodoPagamento =>
  MODI_INCASSO.some((x) => x.chiave === modo);

/** I campi come li vede la persona: la lettura, poi le sue correzioni. La data viene, in ordine, dallo
 *  screenshot, dal giorno e mese con l'anno proposto (R19), dal campo di riserva del caricamento (D16). */
function campiEffettivi(
  l: LettureRiga,
  decisioni: DecisioniRiga | undefined,
  ctx: ContestoValutazione,
): { campi: CampiRiga; dataDaRiserva: boolean } {
  const { indirizzo: ind, tessera: tes, pagamento: pag } = l;
  const mod = decisioni?.modifiche;
  const dataLetta = pag?.data || (pag?.meseGiorno ? proponiData(pag.meseGiorno, ctx.oggi) : "");
  // La riserva vale solo se né lo screenshot né la persona hanno dato una data.
  const riserva =
    !dataLetta && !(mod && mod.data !== undefined) ? testo(ctx.lotto.dataSeManca).trim() : "";
  const base: CampiRiga = {
    nome: tes?.nome ?? "",
    cognome: tes?.cognome ?? "",
    codiceFiscale: tes?.codiceFiscale ?? "",
    indirizzo: ind?.indirizzo ?? "",
    cap: ind?.cap ?? "",
    comune: ind?.comune ?? "",
    provincia: ind?.provincia ?? "",
    importo: pag?.importo ?? null,
    data: dataLetta || riserva,
    // Il modo fuori elenco (PayPal, Satispay…) resta vuoto: la regola di riga lo blocca guardando la lettura, mai un bonifico di ripiego.
    modo: pag && modoGestito(pag.modo) ? pag.modo : "",
    riferimento: pag?.riferimento ?? "",
  };
  return { campi: applicaModifiche(base, mod), dataDaRiserva: !!riserva };
}

/** I campi di una fattura già emessa (le letture sono state svuotate dopo l'emissione). */
function campiDaFattura(f: Fattura): CampiRiga {
  const c = f.cliente;
  return {
    nome: c.nome,
    cognome: c.cognome,
    codiceFiscale: c.codiceFiscale,
    indirizzo: c.indirizzo,
    cap: c.cap,
    comune: c.comune,
    provincia: c.provincia,
    importo: f.totale,
    data: f.data,
    modo: f.metodoPagamento ?? "",
    riferimento: f.riferimentoPagamento ?? "",
  };
}

/* ══ 3. I RIFERIMENTI GENERICI ═════════════════════════════════════════════ */

/** Le parole che stanno davanti a un riferimento senza essere il riferimento («CRO», «bonifico istantaneo»…). */
const PAROLE_VUOTE =
  /\b(?:BONIFICO|ISTANTANEO|ORDINARIO|SEPA|PAGAMENTO|RICARICA|POS|CARTA|CONTANTI|SUMUP|RIFERIMENTO|RIF|CRO|TRN|OPERAZIONE|TRANSAZIONE|ORDINE|NUMERO|ID|DEL|DI)\b/g;

/** Il riferimento se è un VERO riferimento (CRO, codice dell'operazione): tolte le parole generiche restano almeno 6
 *  caratteri e una cifra. Altrimenti "" (non vale per i doppioni). «BONIFICO», «RICARICA 2026», «ABCDEF» sono generici. */
export function riferimentoUtile(rif: string): string {
  const resto = testo(rif)
    .toUpperCase()
    .replace(PAROLE_VUOTE, " ")
    .replace(/[^A-Z0-9]/g, "");
  return resto.length >= 6 && /\d/.test(resto) ? testo(rif) : "";
}

/* ══ 4. IL LOTTO: I MOTIVI CHE VALGONO PER TUTTE LE RIGHE ══════════════════ */

function motiviDelLotto(ctx: ContestoValutazione): Motivo[] {
  const motivi = controllaLotto(ctx.azienda);
  if (!descrizioneAmmessa(ctx.lotto.descrizione))
    motivi.push({
      codice: "descrizione_non_ammessa",
      gravita: "blocca",
      testo:
        "La descrizione scelta per il caricamento non è fra quelle pronte (devono restare neutre, senza riferimenti a salute o detrazioni): scegline una dall'elenco.",
    });
  return motivi;
}

/* ══ 5. LE ALTRE RIGHE, PER I DOPPIONI ═════════════════════════════════════ */

const chiusa = (d: DecisioniRiga | undefined): boolean =>
  d?.stato === "emessa" || d?.stato === "scartata";

/** Le righe APERTE del lotto, nella forma che serve a `trovaDoppioni`. Le emesse stanno già fra le fatture (con
 *  `origineBulk`) e le scartate non devono più bloccare nessuno: per questo non ci sono. */
export function righePerDoppioni(
  righe: IngressoRiga[],
  ctx: ContestoValutazione,
): RigaPerDoppioni[] {
  return righe
    .filter((r) => !chiusa(r.decisioni))
    .map((r) => {
      const l = lettureDel(r.gruppo, r.file);
      const { campi } = campiEffettivi(l, r.decisioni, ctx);
      return {
        idRiga: r.gruppo.idRiga,
        numero: r.gruppo.numero,
        campi,
        improntaPagamento: l.improntaPagamento,
        riferimento: riferimentoUtile(campi.riferimento),
      };
    });
}

/* ══ 6. LA VALUTAZIONE DI UNA RIGA ═════════════════════════════════════════ */

const TESTO_ERRORE_LETTURA: Record<string, string> = {
  timeout: "tempo scaduto",
  limite: "troppe richieste in poco tempo",
  credito: "credito dell'AI finito",
  rete: "problema di rete",
  troncata: "risposta incompleta",
  illeggibile: "screenshot illeggibile",
};

const PESO: Record<Motivo["gravita"], number> = { blocca: 0, conferma: 1, avviso: 2 };

const senzaDatiPersonali = (t: string): string => t.replace(/\s*«[^»]*»/g, "");

function esito(
  gruppo: GruppoRicomposto,
  campi: CampiRiga,
  motivi: Motivo[],
  decisioni: DecisioniRiga | undefined,
  scheda: string | null,
  extra: Pick<RigaValutata, "fattura" | "totaleNelFile" | "ultimoGiornoUtile">,
): RigaValutata {
  const ordinati = [...motivi].sort((a, b) => PESO[a.gravita] - PESO[b.gravita]);
  const { stato, emettibile } = statoDi(
    ordinati,
    decisioni?.confermeAvvisi ?? [],
    !!decisioni?.confermata,
  );
  const visibile: StatoVisibile =
    stato === "pronto" && decisioni?.confermata ? "confermata" : stato;
  return {
    idRiga: gruppo.idRiga,
    numero: gruppo.numero,
    stato: visibile,
    emettibile,
    campi,
    motivi: ordinati,
    scheda,
    ...extra,
  };
}

function valuta(
  riga: IngressoRiga,
  ctx: ContestoValutazione,
  altre: RigaPerDoppioni[],
  motiviLotto: Motivo[],
): RigaValutata {
  const { gruppo, decisioni } = riga;
  const base = {
    idRiga: gruppo.idRiga,
    numero: gruppo.numero,
    emettibile: false,
    motivi: [] as Motivo[],
    scheda: decisioni?.scheda ?? null,
  };

  // Righe chiuse: nessuna regola, nessun doppione. L'emessa mostra quel che dice la sua fattura.
  if (decisioni?.stato === "scartata") return { ...base, stato: "scartata", campi: CAMPI_VUOTI };
  if (decisioni?.stato === "emessa") {
    const f = cercaPerOrigine(ctx.emesse, ctx.lotto.lotto, gruppo.idRiga);
    return { ...base, stato: "emessa", campi: f ? campiDaFattura(f) : CAMPI_VUOTI };
  }

  const l = lettureDel(gruppo, riga.file);
  const { campi, dataDaRiserva } = campiEffettivi(l, decisioni, ctx);

  // Gruppo incompleto: errore strutturale. Se un file è fallito o non è ancora letto, «manca il pagamento» sarebbe fuorviante.
  if (gruppo.incompleta) {
    const fallito = l.file.find((f) => f.stato === "errore");
    const inAttesa = l.file.some((f) => f.stato === "caricando" || f.stato === "salvato");
    let motivi: Motivo[];
    if (fallito)
      motivi = [
        {
          codice: "lettura_fallita",
          gravita: "blocca",
          strutturale: true,
          testo: `La lettura di uno screenshot non è riuscita (${TESTO_ERRORE_LETTURA[fallito.errore ?? ""] ?? "errore"}): premi «Rileggi». Se non passa, correggi a mano o scarta la riga.`,
        },
      ];
    else if (inAttesa)
      motivi = [
        {
          codice: "in_attesa_lettura",
          gravita: "blocca",
          strutturale: true,
          testo:
            "Gli screenshot di questa riga non sono ancora stati letti: aspetta la fine della lettura.",
        },
      ];
    else
      motivi = esaminaRiga(campi, {
        oggi: ctx.oggi,
        gruppo,
        indirizzo: l.indirizzo,
        tessera: l.tessera,
        pagamento: l.pagamento,
        dataDaRiserva,
      });
    return esito(gruppo, campi, motivi, decisioni, base.scheda, {});
  }

  const motivi = esaminaRiga(campi, {
    oggi: ctx.oggi,
    gruppo,
    indirizzo: l.indirizzo,
    tessera: l.tessera,
    pagamento: l.pagamento,
    dataDaRiserva,
  });

  // La scheda: scelta a mano (anche «nessuna») oppure abbinata. Non si crea e non si modifica mai.
  let scheda: string | null;
  if (decisioni && decisioni.scheda !== undefined) {
    // Scelta a mano (anche «nessuna» = null, senza motivi). Resta valida solo se la scheda esiste e non è di un'altra persona.
    scheda = decisioni.scheda;
    const scelta = scheda === null ? null : ctx.schede.find((x) => x.id === scheda);
    if (scheda !== null && !scelta)
      motivi.push({
        codice: "scheda_non_trovata",
        gravita: "blocca",
        testo: "La scheda scelta non esiste più: scegline un'altra oppure togli il collegamento.",
      });
    else if (scelta) motivi.push(...cfDiversoDellaScheda(campi, scelta));
  } else {
    const a = abbinaScheda(campi, l.indirizzo?.telefono ?? "", ctx.schede);
    scheda = a.scheda?.id ?? null;
    motivi.push(...a.motivi);
  }

  // Doppioni: mai contro se stessa (la fattura con lo stesso lotto e la stessa riga non conta), solo righe aperte.
  const emesseAltre = ctx.emesse.filter(
    (f) => !(f.origineBulk?.lotto === ctx.lotto.lotto && f.origineBulk?.riga === gruppo.idRiga),
  );
  motivi.push(
    ...trovaDoppioni(
      {
        idRiga: gruppo.idRiga,
        numero: gruppo.numero,
        campi,
        improntaPagamento: l.improntaPagamento,
        riferimento: riferimentoUtile(campi.riferimento),
        schedaId: scheda,
      },
      {
        emesse: emesseAltre,
        bozze: ctx.bozze,
        altreRighe: altre,
        altriLotti: ctx.impronteAltriLotti,
      },
    ),
  );

  // Ordine delle date rispetto all'ultima emessa (della serie del centro).
  if (/^\d{4}-\d{2}-\d{2}$/.test(campi.data)) {
    const anteriore = esitoOrdineDate(campi.data, emesseAltre, ctx.azienda.serie || "");
    if (anteriore) motivi.push(anteriore);
  }

  // Il centro: vale per tutte le righe, prima di ogni emissione.
  motivi.push(...motiviLotto);

  // La fattura simulata e problemiXml. Se nessuna regola ha già bloccato la riga, un rifiuto qui è un blocco nuovo.
  let fattura: Fattura | undefined;
  let totaleFile: number | undefined;
  try {
    fattura = fatturaDaRiga({
      campi,
      azienda: ctx.azienda,
      lotto: ctx.lotto.lotto,
      idRiga: gruppo.idRiga,
      descrizione: ctx.lotto.descrizione,
      leadId: scheda,
      numeroProvvisorio: gruppo.numero,
      impronte: l.improntaPagamento ? [l.improntaPagamento] : [],
      adesso: `${ctx.oggi}T00:00:00.000Z`,
    });
  } catch (e) {
    if (!motivi.some((m) => m.gravita === "blocca"))
      motivi.push({
        codice: "non_fatturabile",
        gravita: "blocca",
        testo: `La fattura non si può preparare: ${(e instanceof Error ? e.message : "errore").replace(/^fatturaDaRiga: /, "")}.`,
      });
  }
  if (fattura) {
    const xml = problemiXml(fattura, ctx.azienda);
    const giaBloccata = motivi.some((m) => m.gravita === "blocca");
    if (!giaBloccata)
      for (const b of xml.bloccanti) {
        // shortcut: il CF omocodico è l'unico bloccante di xml.ts che le regole di riga non vedono; se ne arrivasse un altro, resta il testo di problemiXml senza i dati tra «».
        if (
          b.startsWith("Il codice fiscale del cliente non è valido") &&
          cfValido(campi.codiceFiscale)
        )
          motivi.push({
            codice: "xml_cf_omocodico",
            gravita: "blocca",
            campo: "codiceFiscale",
            testo:
              "Il codice fiscale è valido ma ha lettere al posto di alcune cifre (omocodia), e il file della fattura per ora non lo accetta (limite noto del CRM). Fai questa fattura a mano dalla scheda del cliente.",
          });
        else if (b.startsWith("La data della fattura è nel futuro") && campi.data <= ctx.oggi)
          // Per le regole di riga la data va bene (oggi, in Italia): è xml.ts che guarda l'orologio UTC (D8/D9).
          motivi.push({
            codice: "xml_dopo_mezzanotte",
            gravita: "blocca",
            campo: "data",
            testo:
              "È appena passata la mezzanotte: il file della fattura conta ancora il giorno prima e rifiuta una data di oggi. Riprova fra un paio d'ore.",
          });
        else
          motivi.push({
            codice: "xml_bloccante",
            gravita: "blocca",
            testo: `${senzaDatiPersonali(b)}.`,
          });
      }
    try {
      totaleFile = totaleNelFile(fattura, ctx.azienda);
      const centesimo = avvisoTotaleXml(fattura, ctx.azienda);
      if (centesimo) motivi.push(centesimo);
      // L'avviso del totale in archivio di problemiXml dice lo stesso fatto: uno solo.
      for (const a of xml.avvisi)
        if (!(centesimo && a.startsWith("Il totale in archivio")))
          motivi.push({
            codice: "xml_avviso",
            gravita: "avviso",
            testo: `${senzaDatiPersonali(a)}.`,
          });
    } catch {
      motivi.push({
        codice: "non_fatturabile",
        gravita: "blocca",
        testo:
          "Il file della fattura non si riesce a costruire con questi dati: controlla i campi della riga.",
      });
    }
  }

  return esito(gruppo, campi, motivi, decisioni, scheda, {
    ...(fattura ? { fattura } : {}),
    ...(totaleFile !== undefined ? { totaleNelFile: totaleFile } : {}),
    ...(ultimoGiornoUtile(campi.data) ? { ultimoGiornoUtile: ultimoGiornoUtile(campi.data) } : {}),
  });
}

/** Una riga. `altre` = le altre righe aperte del lotto (`righePerDoppioni`), per i doppioni fra righe; senza, la riga non le vede.
 *  ⚠️ IL SERVER NON LA USA DIRETTAMENTE: prima di emettere si chiama `valutaRigaNelLotto`, che le altre righe le trova da sé. */
export const valutaRiga = ((
  riga: IngressoRiga,
  ctx: ContestoValutazione,
  altre: RigaPerDoppioni[] = [],
): RigaValutata => valuta(riga, ctx, altre, motiviDelLotto(ctx))) satisfies ValutaRiga;

/** L'ENTRATA DEL SERVER (T12): la riga `idRiga` valutata dentro il suo lotto. Le altre righe si ricavano da `righe`, quindi non
 *  si può dimenticare di vederle: il risultato è identico a quello di `valutaLotto` per quella riga. Un id che non c'è è un errore. */
export function valutaRigaNelLotto(
  idRiga: string,
  righe: IngressoRiga[],
  ctx: ContestoValutazione,
): RigaValutata {
  const riga = righe.find((r) => r.gruppo.idRiga === idRiga);
  if (!riga) throw new Error("valutaRigaNelLotto: la riga non è nel lotto");
  return valuta(riga, ctx, righePerDoppioni(righe, ctx), motiviDelLotto(ctx));
}

/** Tutto il lotto: le righe nell'ordine dato, i fatti sulle date (D1b) e i motivi del centro (una volta sola). */
export function valutaLotto(
  righe: IngressoRiga[],
  ctx: ContestoValutazione,
): { righe: RigaValutata[]; fatti: FattiSulleDate; motiviLotto: Motivo[] } {
  const motiviLotto = motiviDelLotto(ctx);
  const altre = righePerDoppioni(righe, ctx);
  const valutate = righe.map((r) => valuta(r, ctx, altre, motiviLotto));
  const daEmettere = valutate.filter(
    (r) => r.stato === "pronto" || r.stato === "da_controllare" || r.stato === "confermata",
  );
  return {
    righe: valutate,
    fatti: fattiSulleDate(
      daEmettere.map((r) => ({ idRiga: r.idRiga, data: r.campi.data })),
      ctx.emesse,
      ctx.azienda,
      ctx.oggi,
    ),
    motiviLotto,
  };
}

/** Le decisioni dopo che la persona ha corretto dei campi: i campi si uniscono e TUTTE LE CONFERME SI TOLGONO, della
 *  riga e dei singoli motivi (come fa il server). Una conferma per codice passerebbe in silenzio su un fatto nuovo:
 *  confermato il doppione della fattura A, corretto il CF, uscirebbe un doppione della B già «confermato». Non muta l'ingresso. */
export function conModifiche(
  decisioni: DecisioniRiga | undefined,
  modifiche: Partial<CampiRiga>,
  idRiga?: string,
): DecisioniRiga {
  const id = decisioni?.idRiga ?? idRiga;
  if (!id) throw new Error("conModifiche: serve l'id della riga");
  return {
    ...(decisioni ?? { idRiga: id, stato: "aperta" as const }),
    modifiche: { ...decisioni?.modifiche, ...modifiche },
    confermata: false,
    confermeAvvisi: [],
  };
}
