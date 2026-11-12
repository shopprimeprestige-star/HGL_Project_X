/** ── FATTURE BULK · REGOLE DI RIGA (regole-riga.ts) ──
 *  Funzioni pure: dati i campi effettivi di una riga e le letture dei tre
 *  screenshot, dicono perché la riga non è «pronta». Ogni motivo ha un CODICE
 *  stabile (la conferma si dà per codice), una gravità e una frase italiana che
 *  dice cosa non va e dove si corregge. Nessun testo contiene dati di persona.
 *
 *  La data anteriore all'ultima fattura emessa NON è qui: è esitoOrdineDate
 *  (T7), un solo punto in cui il commercialista può farla tornare «blocca».
 *
 *  ⚠️ Cosa non c'è, per scelta: l'elenco delle sigle di provincia (cambia, un
 *   elenco fisso rifiuterebbe righe valide), l'avviso «pagamento senza nome del
 *   pagante» (comparirebbe su quasi ogni pagamento al POS). */
import { cfValido, combaciaConNome, normalizzaCF } from "../../codice-fiscale";
import { scriviEuro } from "../../euro";
import { comeNelFile } from "../xml";
import { MODI_INCASSO } from "../modi-di-incasso";
import { GIORNI_TERMINE_SDI } from "./chiavi";
import type {
  CampiRiga, ContestoRiga, EsitoStato, LetturaIndirizzo, LetturaPagamento, LetturaTessera, Motivo,
} from "./tipi";

/* ══ DATE ═════════════════════════════════════════════════════════════════ */

/** Oggi nel fuso italiano (AAAA-MM-GG). ⚠️ Non UTC: tra le 00:00 e le 01-02 italiane
 *  la data UTC è ancora «ieri» e un pagamento di oggi sembrerebbe il contrario (D9). */
export function oggiItaliano(adesso: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(adesso);
}

const pezziData = (iso: string): [number, number, number] | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

/** Una data che esiste davvero nel calendario (29/02/2028 sì, 29/02/2027 no). */
function dataEsiste(a: number, m: number, g: number): boolean {
  const d = new Date(Date.UTC(a, m - 1, g));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === g;
}

const dataValida = (iso: string): boolean => {
  const p = pezziData(iso);
  return !!p && dataEsiste(...p);
};

const giorniTra = (da: string, a: string): number => {
  const [d, e] = [pezziData(da)!, pezziData(a)!];
  return Math.round((Date.UTC(e[0], e[1] - 1, e[2]) - Date.UTC(d[0], d[1] - 1, d[2])) / 86_400_000);
};

const aggiungiGiorni = (iso: string, n: number): string => {
  const p = pezziData(iso)!;
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
};

const comeSiLegge = (iso: string): string => iso.split("-").reverse().join("/");

/** Lo screenshot mostra giorno e mese ma non l'anno (R19): il più recente che non sia nel futuro.
 *  `meseGiorno` = «MM-GG». Vuoto se non è una data possibile in nessun anno vicino. */
export function proponiData(meseGiorno: string, oggi: string): string {
  const m = /^(\d{2})-(\d{2})$/.exec(meseGiorno);
  const adOggi = pezziData(oggi);
  if (!m || !adOggi) return "";
  // Fino a 8 anni indietro: due 29 febbraio distano al più 8 anni.
  for (let anno = adOggi[0]; anno > adOggi[0] - 9; anno -= 1) {
    if (!dataEsiste(anno, Number(m[1]), Number(m[2]))) continue;
    const iso = `${anno}-${m[1]}-${m[2]}`;
    if (iso <= oggi) return iso;
  }
  return "";
}

/* ══ TESTI E CONFRONTI ════════════════════════════════════════════════════ */

const NOME_CAMPO: Record<keyof CampiRiga, string> = {
  nome: "il nome", cognome: "il cognome", codiceFiscale: "il codice fiscale", indirizzo: "l'indirizzo", cap: "il CAP",
  comune: "il comune", provincia: "la provincia", importo: "l'importo", data: "la data del pagamento", modo: "il modo di pagamento",
  riferimento: "il riferimento",
};

const NOME_MODO: Record<string, string> = { paypal: "PayPal", satispay: "Satispay", altro: "un modo che il CRM non conosce" };

const vuoto = (s: string): boolean => !String(s ?? "").trim();
const maiuscola = (s: string): string => s[0].toUpperCase() + s.slice(1);

/** Le parole del cognome senza accenti, apostrofi e maiuscole: «D'Angelo» = «Dangelo». */
const paroleDi = (s: string): string[] =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().split(/[^A-Z]+/).filter(Boolean);

/** Stesso cognome: uguale, oppure tutte le parole del più corto stanno nell'altro («Rossi» e «Rossi Bianchi»).
 *  Non basta che uno contenga l'altro come testo: «Rossi» non è «Rossini». */
function stessoCognome(a: string, b: string): boolean {
  const [pa, pb] = [paroleDi(a), paroleDi(b)];
  if (pa.length === 0 || pb.length === 0) return true; // niente da confrontare
  if (pa.join("") === pb.join("")) return true;
  const [corto, lungo] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  return corto.every((p) => lungo.includes(p));
}

const uguali = (a: unknown, b: unknown): boolean => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

/* ══ LE REGOLE ════════════════════════════════════════════════════════════ */

/** Tutti i motivi per cui la riga non è pronta (obbligatori, coerenza, soglie, date, modo, caratteri…). */
export function esaminaRiga(campi: CampiRiga, ctx: ContestoRiga): Motivo[] {
  const m: Motivo[] = [];
  const aggiungi = (gravita: Motivo["gravita"], codice: string, testo: string, campo?: keyof CampiRiga) =>
    m.push({ codice, gravita, testo, ...(campo ? { campo } : {}) });
  const { gruppo, indirizzo, tessera, pagamento, oggi } = ctx;

  // 1. Il gruppo. Un gruppo incompleto non si corregge a mano: è la sola cosa che si dice.
  if (gruppo.incompleta) {
    const mancano = gruppo.mancano.map((t) => (t === "tessera" ? "la tessera sanitaria" : t === "pagamento" ? "il pagamento" : "l'indirizzo"));
    m.push({
      codice: "gruppo_incompleto", gravita: "blocca", strutturale: true,
      testo: `Gruppo incompleto: manca ${mancano.join(" e ")}. Controlla i file caricati (forse ne manca uno) oppure scarta la riga.`,
    });
    return m;
  }
  if (gruppo.ricomposta)
    aggiungi("conferma", "ricomposta", "Sequenza ricomposta dai tipi dopo un file mancante o in più: controlla che i 3 screenshot siano della stessa persona.");
  // Sempre «conferma»: un file mancante o in più dà gruppi «completi» di persone diverse con l'ordine cambiato
  // (es. un cliente senza indirizzo seguito da uno completo ne prende l'indirizzo) e niente altro li fermerebbe.
  if (gruppo.ordineDiverso)
    aggiungi("conferma", "ordine_diverso", "Gli screenshot erano in un ordine diverso dal solito: controlla nelle miniature che i 3 siano della stessa persona, poi conferma.");
  if (indirizzo?.indirizzoDiSpedizione)
    aggiungi("conferma", "indirizzo_di_spedizione", "Lo screenshot sembra un indirizzo di spedizione: la fattura vuole la residenza. Controlla che sia quella.", "indirizzo");

  // 2. Dati della persona.
  if (vuoto(campi.nome)) aggiungi("blocca", "nome_mancante", "Manca il nome: scrivilo guardando la tessera sanitaria.", "nome");
  if (vuoto(campi.cognome)) aggiungi("blocca", "cognome_mancante", "Manca il cognome: scrivilo guardando la tessera sanitaria.", "cognome");

  const cf = normalizzaCF(campi.codiceFiscale);
  const cfGrezzo = cf || normalizzaCF(tessera?.cfLetto ?? "");
  if (/^\d{11}$/.test(cfGrezzo))
    aggiungi("blocca", "cf_partita_iva", "Il codice fiscale ha 11 cifre, come una partita IVA: la tessera sanitaria ne ha 16 tra lettere e cifre. Correggilo.", "codiceFiscale");
  else if (!cf && !cfGrezzo) aggiungi("blocca", "cf_mancante", "Manca il codice fiscale: scrivilo guardando la tessera sanitaria.", "codiceFiscale");
  else if (!cf || !cfValido(cf))
    aggiungi("blocca", "cf_non_valido", "Il codice fiscale non supera il controllo dell'ultimo carattere (letto male?): correggilo guardando la tessera.", "codiceFiscale");
  else if (!vuoto(campi.nome) && !vuoto(campi.cognome)) {
    const esito = combaciaConNome(cf, campi.nome, campi.cognome);
    if (esito === "no") aggiungi("conferma", "cf_non_combacia", "Il codice fiscale non corrisponde a nome e cognome: uno dei due è letto male, oppure è di un'altra persona.", "codiceFiscale");
    else if (esito === "non_verificabile") aggiungi("avviso", "cf_non_verificabile", "Non si può controllare che il codice fiscale corrisponda a nome e cognome (nomi troppo corti).", "codiceFiscale");
  }

  if (indirizzo && !vuoto(indirizzo.cognome) && !vuoto(campi.cognome) && !stessoCognome(indirizzo.cognome, campi.cognome))
    aggiungi("blocca", "persone_diverse", "Il cognome sull'indirizzo e quello sulla tessera sono diversi: i tre screenshot potrebbero essere di persone diverse. Controlla le miniature.", "cognome");

  // 3. Indirizzo (residenza). Mai «IT» di ripiego: un CAP non italiano resta un blocco.
  if (vuoto(campi.indirizzo)) aggiungi("blocca", "indirizzo_mancante", "Manca l'indirizzo (via e numero civico): scrivilo guardando lo screenshot dell'indirizzo.", "indirizzo");
  const cap = campi.cap.trim();
  if (!cap) aggiungi("blocca", "cap_mancante", "Manca il CAP: scrivilo guardando lo screenshot dell'indirizzo.", "cap");
  else if (!/^\d{5}$/.test(cap))
    aggiungi("blocca", "indirizzo_estero", "Il CAP non ha 5 cifre: l'indirizzo sembra estero o letto male. Questa funzione fattura solo privati residenti in Italia.", "cap");
  if (vuoto(campi.comune)) aggiungi("blocca", "comune_mancante", "Manca il comune: scrivilo guardando lo screenshot dell'indirizzo.", "comune");
  const prov = campi.provincia.trim();
  if (!prov) aggiungi("blocca", "provincia_mancante", "Manca la provincia (sigla di 2 lettere, per esempio RM): scrivila nella riga.", "provincia");
  else if (!/^[A-Z]{2}$/.test(prov)) aggiungi("blocca", "provincia_non_valida", "La provincia deve essere la sigla di 2 lettere maiuscole (per esempio RM).", "provincia");

  // 4. Caratteri e lunghezze che il file XML cambierebbe in silenzio (R14).
  for (const campo of ["nome", "cognome", "indirizzo", "comune"] as const) {
    const v = campi[campo].trim();
    if (!v) continue;
    const nelFile = comeNelFile(v);
    if (nelFile !== v)
      aggiungi("conferma", `caratteri_${campo}`, `${maiuscola(NOME_CAMPO[campo])} ha lettere che il file della fattura non ammette: nel file verrebbero tolte. Correggilo (senza quelle lettere) oppure confermalo.`, campo);
    else if (nelFile.length > 60)
      aggiungi("conferma", `troppo_lungo_${campo}`, `${maiuscola(NOME_CAMPO[campo])} supera i 60 caratteri: nel file della fattura verrebbe tagliato. Accorcialo o confermalo.`, campo);
  }

  // 5. Importo.
  const importo = campi.importo;
  if (importo === null || !Number.isFinite(importo)) aggiungi("blocca", "importo_mancante", "Manca l'importo pagato: scrivilo guardando lo screenshot del pagamento.", "importo");
  else if (importo <= 0) aggiungi("blocca", "importo_non_valido", "L'importo deve essere maggiore di zero.", "importo");
  else if (Math.abs(importo * 100 - Math.round(importo * 100)) > 1e-7)
    aggiungi("blocca", "importo_non_valido", "L'importo ha più di 2 decimali: correggilo (centesimi al massimo).", "importo");
  else {
    if (importo > 10_000) aggiungi("conferma", "importo_alto", `L'importo (${scriviEuro(importo)} €) è insolito: spesso è una cifra letta male. Controllalo sullo screenshot.`, "importo");
    else if (importo < 5) aggiungi("avviso", "importo_basso", `L'importo (${scriviEuro(importo)} €) è molto basso: controllalo sullo screenshot.`, "importo");
    if (pagamento && pagamento.importoAltro !== null && pagamento.importoAltro !== pagamento.importo && importo === pagamento.importo)
      aggiungi("conferma", "due_importi", `Lo screenshot mostra due cifre (${scriviEuro(pagamento.importo ?? 0)} € e ${scriviEuro(pagamento.importoAltro)} €): si fattura quella pagata dal cliente. Controlla quale è.`, "importo");
  }
  if (pagamento) {
    const valuta = pagamento.valuta.trim().toUpperCase();
    if (valuta && !["EUR", "€", "EURO"].includes(valuta))
      aggiungi("blocca", "valuta_non_euro", "Il pagamento non risulta in euro: questa funzione fattura solo in euro. Scarta la riga o falla a mano.");
    if (pagamento.esito === "non_completato")
      aggiungi("blocca", "pagamento_non_completato", "Il pagamento risulta annullato, in attesa o rimborsato: non si fattura. Scarta la riga se è così.");
  }

  // 6. Come ha pagato. Mai un bonifico di ripiego (sarebbe scrivere il falso in un documento fiscale).
  if (!MODI_INCASSO.some((x) => x.chiave === campi.modo)) {
    const letto = pagamento?.modo ?? "";
    if (letto === "paypal" || letto === "satispay" || letto === "altro")
      aggiungi("blocca", "modo_non_ammesso", `Il pagamento risulta fatto con ${NOME_MODO[letto]}, che non è tra i modi che il CRM sa fatturare. Scegli il modo giusto nella riga o scarta la riga.`, "modo");
    else aggiungi("blocca", "modo_mancante", "Non si capisce come ha pagato: scegli il modo di pagamento nella riga.", "modo");
  } else if (pagamento?.modoIncerto && campi.modo === pagamento.modo)
    aggiungi("conferma", "modo_incerto", "Non è chiaro se è un pagamento con POS o con carta: controlla lo screenshot e scegli il modo giusto, oppure confermalo.", "modo");

  // 7. Data.
  const data = campi.data.trim();
  if (!data) aggiungi("blocca", "data_mancante", "Manca la data del pagamento: scrivila guardando lo screenshot. Non si usa mai quella di oggi.", "data");
  else if (!dataValida(data)) aggiungi("blocca", "data_non_valida", "La data del pagamento non esiste nel calendario: correggila (formato giorno/mese/anno).", "data");
  else if (data > oggi) aggiungi("blocca", "data_futura", "La data del pagamento è nel futuro: correggila.", "data");
  else {
    if (ctx.dataDaRiserva) aggiungi("conferma", "data_di_riserva", "Lo screenshot non mostra la data: è stata presa dal campo di riserva del caricamento. Controlla che sia giusta.", "data");
    if (pagamento && !pagamento.data && pagamento.meseGiorno && data === proponiData(pagamento.meseGiorno, oggi))
      aggiungi("conferma", "anno_proposto", `Nello screenshot non si vede l'anno: proposto il ${comeSiLegge(data)} (il più recente che non sia futuro). Controllalo.`, "data");
    if (pagamento?.formatoAmbiguo && data === pagamento.data)
      aggiungi("conferma", "data_ambigua", "La data potrebbe essere giorno/mese oppure mese/giorno: controlla lo screenshot.", "data");
    if (Number(data.slice(0, 4)) < Number(oggi.slice(0, 4)))
      aggiungi("conferma", "anno_diverso", `La data è di un anno diverso da quello in corso: la fattura entrerebbe nella numerazione del ${data.slice(0, 4)}. Chiedi al commercialista se quel periodo è già chiuso.`, "data");
    if (giorniTra(data, oggi) > GIORNI_TERMINE_SDI)
      aggiungi("conferma", "oltre_12_giorni", `Sono passati più di ${GIORNI_TERMINE_SDI} giorni dal pagamento: l'invio allo SDI andava fatto entro il ${comeSiLegge(aggiungiGiorni(data, GIORNI_TERMINE_SDI))} (stima). La fattura sarà tardiva: confermala solo con l'accordo del commercialista.`, "data");
  }

  // 8. Il pagamento sembra di un'altra persona (un familiare: si può confermare).
  if (pagamento && !vuoto(pagamento.paganteCognome) && !vuoto(campi.cognome) && !stessoCognome(pagamento.paganteCognome, campi.cognome))
    aggiungi("conferma", "pagante_diverso", "Il pagamento sembra fatto da una persona con un cognome diverso da quello della tessera (un familiare?). La fattura resta intestata a chi ha la tessera: confermalo.", "cognome");

  // 9. Campi obbligatori che l'AI dava per incerti e che nessuno ha corretto (D7).
  const incerto = (campo: keyof CampiRiga, letti: string[], letto: unknown, valore: unknown) => {
    if (!letti.includes(campo) || vuoto(String(valore ?? "")) || !uguali(letto, valore)) return;
    aggiungi("conferma", `incerto_${campo}`, `${maiuscola(NOME_CAMPO[campo])} è stato letto con incertezza: controlla lo screenshot, correggilo o confermalo.`, campo);
  };
  const ind: LetturaIndirizzo | undefined = indirizzo, tes: LetturaTessera | undefined = tessera, pag: LetturaPagamento | undefined = pagamento;
  if (ind) for (const k of ["indirizzo", "cap", "comune", "provincia"] as const) incerto(k, ind.incerti, ind[k], campi[k]);
  if (tes) {
    for (const k of ["nome", "cognome"] as const) incerto(k, tes.incerti, tes[k], campi[k]);
    incerto("codiceFiscale", tes.incerti, normalizzaCF(tes.codiceFiscale || tes.cfLetto), cf);
  }
  if (pag) {
    incerto("importo", pag.incerti, pag.importo, campi.importo);
    incerto("data", pag.incerti, pag.data, campi.data);
  }
  return m;
}

/** Stato visibile (`pronto` | `da_controllare` | `errore`) ed `emettibile`. `confermati` = codici accettati.
 *  Un `blocca` non si libera mai con una conferma; un `conferma` sì (per codice); la riga va confermata a parte. */
export function statoDi(motivi: Motivo[], confermati: string[], rigaConfermata: boolean): EsitoStato {
  const daConfermare = motivi.some((x) => x.gravita === "conferma" && !confermati.includes(x.codice));
  const blocca = motivi.some((x) => x.gravita === "blocca");
  const stato = motivi.some((x) => x.strutturale) ? "errore" : blocca || daConfermare ? "da_controllare" : "pronto";
  return { stato, emettibile: !blocca && !daConfermare && rigaConfermata };
}
