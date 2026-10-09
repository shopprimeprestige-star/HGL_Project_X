/** ── COSA SI PUÒ FARE, LEGALMENTE, PER PAGARE MENO ─────────────────────────
 *
 *  Richiesta del committente: «dai suggerimenti come un vero esperto fiscale».
 *  Questo modulo prende i numeri veri del periodo e ci appoggia sopra le leve
 *  che una S.r.l.s. ha davvero, ognuna con quanto varrebbe QUI — non in
 *  generale — e con la sua controindicazione scritta accanto.
 *
 *  ── ⚠️ LA REGOLA CHE VIENE PRIMA DI TUTTE LE ALTRE ────────────────────────
 *  Un costo abbassa le imposte del 27,9% e ti toglie il 100% dei soldi. Non
 *  esiste nessuna spesa che convenga fare «per scaricarla»: comprare una cosa
 *  da 1.000 € che non serve fa risparmiare 279 € di imposte e ne fa uscire
 *  1.000. Tutto quello che c'è qui sotto vale a una condizione sola — che
 *  quella spesa tu l'avresti fatta comunque, o che ti serva davvero. Chi
 *  vende «tecniche» che ignorano questa riga sta vendendo altro.
 *
 *  ── ⚠️ E LA SECONDA: L'INERENZA ───────────────────────────────────────────
 *  art. 109 c. 5 TUIR. Un costo si deduce se riguarda l'attività. Le spese
 *  personali intestate alla società, le fatture per cose mai ricevute e i
 *  costi «di comodo» non sono tecniche fiscali: sono, a seconda della cifra,
 *  una ripresa a tassazione con sanzioni o un reato. Questo modulo non ne
 *  contiene, e non è una dimenticanza.
 *
 *  ── ⚠️ E LA TERZA: QUESTE SONO LE REGOLE ORDINARIE, NON L'ULTIMA LEGGE ────
 *  Aliquote, soglie e crediti d'imposta cambiano ogni anno con la legge di
 *  bilancio. Quello che c'è qui è il quadro stabile; prima di muovere soldi
 *  su una singola voce si chiede a chi tiene i libri se quel comma è ancora
 *  in piedi quest'anno. La frase «lo dice il gestionale» non è mai stata una
 *  difesa in una verifica.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { Aliquote, ContoFiscale } from "./contabilita";

export interface Consiglio {
  id: string;
  titolo: string;
  /** Cosa è, in parole normali. */
  cosa: string;
  /** L'articolo, per chi lo deve verificare. */
  norma: string;
  /** La controindicazione. Ogni leva ne ha una, e nasconderla è il modo in cui
   *  un consiglio diventa un danno. */
  attenzione: string;
  /** Quanto varrebbe qui, in imposte risparmiate. Assente quando dipende da
   *  cose che questo programma non sa. */
  vale?: number;
  /** Il conto fatto per arrivarci, scritto: un numero senza il suo conto non
   *  si può controllare, e quindi non si può usare. */
  conto?: string;
  forza: "alta" | "media" | "bassa";
}

const c2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** ── ⚠️ QUANTO VALE UN EURO DI COSTO IN PIÙ ───────────────────────────────
 *  IRES più IRAP: con le aliquote ordinarie fa il 27,9%. È il moltiplicatore
 *  di tutte le stime qui sotto — tranne quelle che l'IRAP non la toccano, e
 *  sono segnate una per una perché è l'errore che fa sovrastimare i risparmi.
 *  ⚠️ Vale solo finché c'è un utile da abbattere: sotto zero non si risparmia
 *   niente, si accumula una perdita — che è comunque un valore, ma un altro
 *   (vedi il consiglio sulle perdite riportate). */
const risparmio = (importo: number, a: Aliquote, conIrap = true) =>
  c2((importo * (a.ires + (conIrap ? a.irap : 0))) / 100);

export function consigli(
  conto: ContoFiscale,
  aliquote: Aliquote,
  opzioni: { mesiDelPeriodo: number } = { mesiDelPeriodo: 12 },
): Consiglio[] {
  const utile = Math.max(0, conto.utileImponibile);
  const ricavi = conto.imponibileFatturato;
  //  Le stime si fanno sull'anno, non sul periodo scelto: un compenso
  //  amministratore è una decisione annuale, e proporzionarla a un mese
  //  darebbe una cifra che non corrisponde a nessuna scelta possibile.
  const anno = opzioni.mesiDelPeriodo > 0 ? 12 / opzioni.mesiDelPeriodo : 1;
  const utileAnno = c2(utile * anno);
  const ricaviAnno = c2(ricavi * anno);
  const lista: Consiglio[] = [];

  /* ── 1. IL COMPENSO ALL'AMMINISTRATORE ─────────────────────────────────
     È la leva più grossa che ha una S.r.l.s. piccola, ed è anche quella che
     più spesso non viene usata perché richiede un pezzo di carta prima. */
  if (utileAnno > 3000) {
    //  Metà dell'utile è una misura ragionevole da mostrare: lascia in
    //  società di che pagare le imposte su quello che resta.
    const compenso = c2(Math.min(utileAnno * 0.5, 60_000));
    lista.push({
      id: "compenso",
      titolo: "Il compenso amministratore",
      cosa: `Deliberare un compenso per l'amministratore è l'unico modo per far uscire soldi dalla società abbattendo l'utile. Su ${eurCorto(compenso)} la società smette di pagare IRES; chi lo incassa paga IRPEF e i contributi della gestione separata INPS (circa il 26%, per due terzi a carico suo). Conviene quando l'aliquota IRPEF di chi lo riceve resta bassa, e quasi mai oltre i 50-55 mila euro l'anno, dove lo scaglione IRPEF supera l'IRES.`,
      norma: "art. 95 c. 5 TUIR — deducibile per CASSA, cioè nell'anno in cui lo paghi",
      attenzione:
        "Vuole una delibera dell'assemblea PRIMA che il compenso maturi: senza, l'Agenzia lo riprende a tassazione e hai pagato i contributi per niente. E non è deducibile ai fini IRAP, quindi il risparmio è il 24%, non il 27,9%.",
      vale: risparmio(compenso, aliquote, false),
      conto: `${eurCorto(compenso)} × 24% di IRES (l'IRAP resta dovuta)`,
      forza: "alta",
    });

    /* ── 2. IL TFM ──────────────────────────────────────────────────────── */
    const tfm = c2(compenso * 0.2);
    lista.push({
      id: "tfm",
      titolo: "Il trattamento di fine mandato",
      cosa: `È la liquidazione dell'amministratore: si accantona ogni anno e si deduce ogni anno, ma si paga solo alla fine del mandato. Su un accantonamento di ${eurCorto(tfm)} l'anno abbatti l'imponibile senza che esca un euro dalla cassa.`,
      norma: "art. 105 c. 4 TUIR, con il rinvio all'art. 17 c. 1 lett. c)",
      attenzione:
        "Si deduce per competenza SOLO se il diritto risulta da un atto con data certa ANTERIORE all'inizio del rapporto: verbale registrato, o PEC. Senza data certa si deduce solo quando lo paghi, e l'accantonamento non vale niente. E l'importo dev'essere proporzionato al compenso, o è elusivo.",
      vale: risparmio(tfm, aliquote, false),
      conto: `${eurCorto(tfm)} accantonati × 24%`,
      forza: "alta",
    });
  }

  /* ── 3. LE FATTURE DA RICEVERE ─────────────────────────────────────────
     Non è una spesa nuova: è smettere di perdere quelle che ci sono già. */
  lista.push({
    id: "competenza",
    titolo: "I costi di dicembre che la fattura arriva a gennaio",
    cosa: "Un costo si deduce nell'anno in cui è stato SOSTENUTO, non in quello in cui arriva la fattura. La merce consegnata a dicembre, la consulenza finita a dicembre, l'affitto di dicembre: si deducono su quell'anno anche se il documento arriva dopo. È la cosa che si perde più spesso, e non costa niente recuperarla — basta un elenco da dare al commercialista a gennaio.",
    norma: "art. 109 c. 1 e 2 TUIR — beni mobili alla consegna, servizi all'ultimazione",
    attenzione:
      "Vale per le imposte sul reddito, NON per l'IVA: quella si detrae quando la fattura c'è ed è registrata. Sono due calendari diversi e vanno tenuti diversi.",
    forza: "alta",
  });

  /* ── 4. LE PERDITE PREGRESSE ───────────────────────────────────────────── */
  lista.push({
    id: "perdite",
    titolo: "Le perdite degli anni prima",
    cosa: "Se la società ha chiuso in perdita, quella perdita non si butta: abbatte gli utili degli anni seguenti, senza limite di tempo, fino all'80% del reddito di ciascun anno. Le perdite dei PRIMI TRE esercizi si usano al 100%, senza il limite dell'80%: per una S.r.l.s. giovane è la differenza fra pagare e non pagare.",
    norma: "art. 84 TUIR",
    attenzione:
      "Le perdite dei primi tre esercizi valgono al 100% solo se si riferiscono a una attività produttiva nuova. Vanno riportate in dichiarazione ogni anno anche quando non si usano, o si perde traccia.",
    forza: "alta",
  });

  /* ── 5. I BENI SOTTO I 516,46 € ────────────────────────────────────────── */
  lista.push({
    id: "beni516",
    titolo: "Tutto quello che costa meno di 516,46 €",
    cosa: "Un bene strumentale che costa fino a 516,46 € si deduce PER INTERO nell'anno in cui lo compri, invece di essere ammortizzato in quattro o cinque. Telefoni, monitor, piccola attrezzatura, strumenti: comprarli a dicembre invece che a gennaio sposta tutta la deduzione di un anno indietro.",
    norma: "art. 102 c. 5 TUIR",
    attenzione:
      "La soglia si guarda sul singolo bene e al netto dell'IVA se la detrai. Un insieme di pezzi che funziona solo tutto insieme conta come un bene solo, e la soglia si supera.",
    forza: "media",
  });

  /* ── 6. TRASFERTE E RIMBORSI ───────────────────────────────────────────── */
  lista.push({
    id: "trasferte",
    titolo: "I rimborsi di trasferta, che non tassano nessuno",
    cosa: "Vitto e alloggio rimborsati a chi va in trasferta fuori dal comune sono un costo per la società e NON sono reddito per chi li riceve, entro 180,76 € al giorno in Italia e 258,23 € all'estero. È l'unico modo di far uscire denaro senza che venga tassato da nessuna parte. Il rimborso chilometrico con le tabelle ACI funziona allo stesso modo.",
    norma: "art. 51 c. 5 TUIR per chi riceve, art. 95 c. 3 per la società",
    attenzione:
      "Dal 2025 vanno pagati con mezzi tracciabili, o non si deducono: niente contanti. E serve la pezza d'appoggio — la trasferta dev'essere documentata, non dichiarata.",
    forza: "media",
  });

  /* ── 7. LA RAPPRESENTANZA, CON IL SUO TETTO ────────────────────────────── */
  if (ricaviAnno > 0) {
    const tetto = c2(ricaviAnno * 0.015);
    lista.push({
      id: "rappresentanza",
      titolo: "Le spese di rappresentanza, fino a un tetto",
      cosa: `Regali ai clienti, cene, eventi: si deducono entro l'1,5% dei ricavi, che con questo fatturato fa ${eurCorto(tetto)} l'anno. Gli omaggi che costano fino a 50 € l'uno si deducono per intero e ne detrai anche l'IVA — sopra i 50 €, l'IVA non si detrae.`,
      norma: "art. 108 c. 2 TUIR · art. 19-bis1 lett. h) DPR 633/72 per l'IVA sugli omaggi",
      attenzione:
        "Il tetto è sui RICAVI, quindi cala se cala il fatturato. E dal 2025 anche queste vogliono il pagamento tracciato. La cena con un cliente è rappresentanza; la cena con un socio non è niente.",
      vale: risparmio(Math.min(tetto, utileAnno), aliquote),
      conto: `${eurCorto(tetto)} (1,5% di ${eurCorto(ricaviAnno)}) × 27,9%`,
      forza: "media",
    });
  }

  /* ── 8. IL WELFARE ─────────────────────────────────────────────────────── */
  lista.push({
    id: "welfare",
    titolo: "I fringe benefit ai dipendenti",
    cosa: "Buoni spesa, rimborso delle utenze di casa, dell'affitto o degli interessi del mutuo: per la società sono costo deducibile, per il dipendente non sono reddito fino a 1.000 € l'anno — 2.000 € per chi ha figli a carico. Sono soldi che arrivano interi invece che dimezzati dalle trattenute.",
    norma: "art. 51 c. 3 TUIR, con le soglie alzate dalle ultime leggi di bilancio",
    attenzione:
      "Sopra la soglia diventa tassabile TUTTO l'importo, non solo l'eccedenza: un euro di troppo fa perdere l'agevolazione su tutto. E le soglie cambiano quasi ogni anno: fatti confermare quella dell'anno in corso.",
    forza: "media",
  });

  /* ── 9. L'AUTO, CHE QUASI MAI CONVIENE ─────────────────────────────────── */
  lista.push({
    id: "auto",
    titolo: "L'auto intestata alla società (di solito no)",
    cosa: "Sta qui perché è la prima cosa che viene in mente e quasi sempre è la peggiore: un'auto aziendale a uso non esclusivo si deduce al 20% e con un tetto sul costo di 18.075,99 €, e l'IVA si detrae al 40%. Su 30.000 € di auto deduci una frazione di quello che credi. Data invece in uso promiscuo a un dipendente per la maggior parte dell'anno si deduce al 70% e l'IVA si detrae tutta — ma allora diventa reddito in busta per lui.",
    norma: "art. 164 TUIR · art. 19-bis1 lett. c) DPR 633/72",
    attenzione:
      "Il carburante va pagato con carta o bonifico, sempre: in contanti non si deduce e non si detrae niente. È l'unico caso in questo programma in cui il modo di pagare cambia le tasse.",
    forza: "bassa",
  });

  /* ── 10. L'IVA CHE SCADE ───────────────────────────────────────────────── */
  if (conto.ivaACredito > 0 || conto.ivaAutoliquidata > 0) {
    lista.push({
      id: "detrazione",
      titolo: "L'IVA a credito ha una scadenza",
      cosa: `In questo periodo hai ${eurCorto(conto.ivaACredito)} di IVA a credito. Il diritto a detrarla si perde se non la registri entro il termine della dichiarazione IVA dell'anno in cui il diritto è nato: una fattura del 2026 registrata dopo il 30 aprile 2027 è imposta persa, e non si recupera in nessun modo.`,
      norma: "art. 19 c. 1 e art. 25 DPR 633/72",
      attenzione:
        "Vale soprattutto per le fatture estere lasciate in un cassetto: l'autofattura non trasmessa entro il 15 del mese dopo è una sanzione, ma la detrazione persa è denaro.",
      vale: conto.ivaACredito,
      conto: "l'IVA a credito già registrata in questo periodo",
      forza: "alta",
    });
  }

  /* ── 11. QUELLO CHE NON SI SCARICA, E PERCHÉ ───────────────────────────── */
  if (conto.costiNonDeducibili > 0) {
    lista.push({
      id: "nondeducibili",
      titolo: "I costi che stai pagando senza scaricarli",
      cosa: `Ci sono ${eurCorto(conto.costiNonDeducibili)} di costi segnati come non deducibili. Sono soldi usciti davvero su cui stai pagando anche le imposte. Per ognuno vale la pena chiedersi se manca solo il documento: un compenso senza fattura, un rimborso senza pezza d'appoggio, un acquisto intestato a una persona invece che alla società. Farsi fare il documento è la cosa che rende ${eurCorto(risparmio(conto.costiNonDeducibili, aliquote))} senza spendere niente.`,
      norma: "art. 109 c. 5 TUIR — l'inerenza va dimostrata, e si dimostra con i documenti",
      attenzione:
        "Alcuni non si scaricano per legge e nessun documento li salva: le sanzioni, le multe, l'IRES stessa. Quelli restano dove sono.",
      vale: risparmio(conto.costiNonDeducibili, aliquote),
      conto: `${eurCorto(conto.costiNonDeducibili)} × 27,9%, se diventassero deducibili`,
      forza: "alta",
    });
  }

  /* ── 12. LA DEDUZIONE IRAP DALL'IRES ───────────────────────────────────── */
  if (conto.irap > 0) {
    lista.push({
      id: "irapires",
      titolo: "L'IRAP si deduce dall'IRES",
      cosa: "Il 10% dell'IRAP pagata si deduce dal reddito IRES, e si deduce per intero la parte di IRAP che si riferisce al costo del personale dipendente. È una deduzione che si perde solo per distrazione, perché non richiede di fare niente: va solo messa in dichiarazione.",
      norma: "art. 6 DL 185/2008 e art. 2 DL 201/2011",
      attenzione:
        "Il 10% forfettario spetta se ci sono interessi passivi; la deduzione sul personale spetta se ci sono dipendenti. Senza né gli uni né gli altri non spetta niente.",
      vale: risparmio(conto.irap * 0.1, aliquote, false),
      conto: `10% di ${eurCorto(conto.irap)} di IRAP × 24%`,
      forza: "bassa",
    });
  }

  /* ── 13. LA COSA CHE NON ESISTE PIÙ ────────────────────────────────────── */
  lista.push({
    id: "ace",
    titolo: "L'ACE non c'è più: se qualcuno te la propone, è vecchio",
    cosa: "L'aiuto alla crescita economica — la deduzione per chi lasciava gli utili in società invece di distribuirli — è stata abolita dal 2024. Restano solo le eccedenze maturate prima, che si portano avanti. Sta qui perché è il consiglio che si trova ancora scritto dappertutto, e seguirlo oggi vuol dire lasciare soldi in azienda aspettandosi uno sconto che non arriva più.",
    norma: "art. 5 DLgs 216/2023, che ha abrogato l'art. 1 DL 201/2011",
    attenzione:
      "Lasciare gli utili in società può restare giusto per altri motivi — la banca, gli investimenti — ma non per questo.",
    forza: "bassa",
  });

  //  ⚠️ L'ORDINE È PARTE DEL CONSIGLIO. Prima quello che vale di più QUI, poi
  //   la forza: una lista alfabetica di leve fiscali si legge come un elenco
  //   di cose da fare tutte, che è il modo migliore per non farne nessuna.
  const peso = { alta: 3, media: 2, bassa: 1 };
  return lista.sort((a, b) => peso[b.forza] - peso[a.forza] || (b.vale ?? 0) - (a.vale ?? 0));
}

/** L'euro corto, per stare dentro una frase: «1.842 €». Il centesimo qui non
 *  serve — sono stime, e scriverle al centesimo le farebbe sembrare esatte. */
function eurCorto(n: number): string {
  return `${Math.round(Number(n) || 0).toLocaleString("it-IT")} €`;
}

/** Quanto si potrebbe risparmiare in tutto, sommando solo le leve con un
 *  numero sotto. ⚠️ NON è un totale da sbandierare: alcune si escludono a
 *  vicenda, e tutte valgono solo se quella spesa serviva. Si mostra come
 *  «ordine di grandezza», mai come obiettivo. */
export const totaleStimabile = (c: Consiglio[]): number =>
  c2(c.reduce((s, x) => s + (x.vale ?? 0), 0));
