/** ── I COSTI DEI MESSAGGI WHATSAPP · TARIFFE E CATEGORIE (29/10/2026) ──────
 *
 *  Un solo posto per le cifre: la nota sotto l'elenco dei modelli, il prezzo di
 *  ogni modello e il pannello dei costi leggono da qui. Niente React: prove in
 *  `prove/manychat/chat-costi.mjs`.
 *
 *  ⚠️ LE TARIFFE sono quelle UFFICIALI di Meta per l'Italia, in EUR, prezzo per
 *   messaggio consegnato, in vigore dal 1 ottobre 2026. Fonte: tariffario in
 *   https://developers.facebook.com/docs/whatsapp/pricing («Tariffe in EUR»,
 *   riga Italy: Marketing 0.0658, Utility 0.0248). Sono prezzi di listino: i livelli
 *   di volume di Meta sulle Utility possono abbassarli, e il conto vero resta nel
 *   Wallet di ManyChat. Se Meta cambia la rate card si cambiano SOLO queste righe.
 *  ⚠️ Il ricarico di ManyChat sui messaggi non è documentato in modo che si possa
 *   leggere da qui: le cifre sono Meta, il resto è «stima».
 *  ⚠️ LA CATEGORIA VERA è quella approvata da Meta e vista in ManyChat, non il
 *   campo `category` di `wa-meta-templates.ts` (i modelli passati a Utility
 *   sono Marketing prima di UTILITY_DAL). Per questo c'è l'elenco qui.
 *  ───────────────────────────────────────────────────────────────────────── */

export type CategoriaCosto = "marketing" | "utility";

/** € per messaggio a pagamento, Italia. */
export const TARIFFE: Record<CategoriaCosto, number> = {
  marketing: 0.0658,
  utility: 0.0248,
};
/** Da quando valgono (ISO) e dove sono scritte. */
export const TARIFFE_DAL = "2026-10-01";
export const TARIFFE_FONTE = "https://developers.facebook.com/docs/whatsapp/pricing";

/** € di un testo normale dentro la finestra aperta dal cliente: per Meta è gratis
 *  (fino a 1.000 conversazioni di servizio al mese per numero, come dice il pannello).
 *  È l'ipotesi già scritta nel pannello dei costi: il «risparmio» è prezzo del modello meno questo.
 *  shortcut: non si conta il tetto delle 1.000 al mese; da cambiare se un mese ci si avvicina. */
export const COSTO_TESTO_IN_FINESTRA = 0;

export const ETICHETTA_CATEGORIA: Record<CategoriaCosto, string> = {
  marketing: "Marketing",
  utility: "Utility",
};

/** La categoria vera dei modelli, per nome senza «hgl_» e senza «_v2»/«_v3». */
const CATEGORIA_DEI_MODELLI: Record<string, CategoriaCosto> = {
  consulenza_conferma_presenza: "utility",
  cliente_assente: "utility",
  meet_adesso: "utility",
  meet_domani: "utility",
  meet_oggi: "utility",
  meet_oggi_link: "utility",
  non_risponde: "utility",
  promemoria_meet: "utility",
  promemoria_sede: "utility",
  richiamo_concordato: "utility",
  sede_disdetta: "utility",
  casi_reali: "marketing",
  da_riprogrammare: "utility",
  meet_da_fissare: "utility",
  acconto: "utility",
  come_eravamo_rimasti: "utility",
  primo_contatto: "utility",
  richiamo_24h: "utility",
  ricontatto_consulenza: "utility",
  ritorno: "utility",
  ultimo_tentativo: "utility",
};

/** Da quando ogni modello passato a Utility si paga Utility (ISO con fuso), per nome senza «hgl_».
 *  Prima gli invii li ha pagati Marketing e la categoria non torna indietro. La imposta il capo
 *  progetto quando i flussi «CRM hgl_…» passano ai modelli «_u» approvati da Meta.
 *  `null` = il modello «_u» è ancora in revisione: si paga ancora Marketing. */
export const UTILITY_DAL: Record<string, string | null> = {
  //  Flussi passati ai modelli «_u» il 30/10/2026 verso le 12:00 (ora solare di Roma: +01:00).
  primo_contatto: "2026-10-30T12:00:00+01:00",
  richiamo_24h: "2026-10-30T12:00:00+01:00",
  ritorno: "2026-10-30T12:00:00+01:00",
  ricontatto_consulenza: "2026-10-30T12:00:00+01:00",
  ultimo_tentativo: "2026-10-30T12:00:00+01:00",
  //  Passati alle 12:30 dello stesso giorno.
  acconto: "2026-10-30T12:30:00+01:00",
  meet_da_fissare: "2026-10-30T12:30:00+01:00",
  //  Ancora in revisione Meta: la data si mette quando si passano i loro flussi.
  come_eravamo_rimasti: "2026-10-30T12:29:00+01:00",
  da_riprogrammare: "2026-10-30T12:29:00+01:00",
};

const nomeBase = (nome: string) => nome.replace(/^hgl_/, "").replace(/_v\d+$/, "");

/** Il modello è nell'elenco delle categorie vere? Se no, la cifra è solo una stima. */
export const categoriaConosciuta = (nome: string): boolean =>
  nomeBase(nome) in CATEGORIA_DEI_MODELLI;

/** La categoria di un modello. Se non è nell'elenco vale quella dichiarata dal
 *  modello; senza nemmeno quella, Marketing (la più cara: mai sottostimare).
 *  `quando` è l'istante dell'invio (ms o Date; senza, adesso): i modelli passati a Utility
 *  si pagano Marketing prima della loro data in `UTILITY_DAL` (e sempre, se la data è `null`). */
export function categoriaModello(
  nome: string,
  dichiarata?: "UTILITY" | "MARKETING",
  quando: number | Date = Date.now(),
): CategoriaCosto {
  const base = nomeBase(nome);
  const nota = CATEGORIA_DEI_MODELLI[base];
  if (nota) {
    const t = typeof quando === "number" ? quando : quando.getTime();
    if (!(base in UTILITY_DAL)) return nota;
    const dal = UTILITY_DAL[base];
    return dal && t >= Date.parse(dal) ? nota : "marketing";
  }
  return dichiarata === "UTILITY" ? "utility" : "marketing";
}

export const prezzoModello = (
  nome: string,
  dichiarata?: "UTILITY" | "MARKETING",
  quando?: number | Date,
): number => TARIFFE[categoriaModello(nome, dichiarata, quando)];

/** «0,0658 €»: la virgola all'italiana. */
export function euro(n: number, decimali = 2): string {
  return `${n.toFixed(decimali).replace(".", ",")} €`;
}

const DATA_TARIFFE = "1 ottobre 2026";

/** La nota sotto l'elenco dei modelli: si paga, e quanto. */
export function notaPrezzi(): string {
  return (
    `Ogni modello si paga: Marketing ≈ ${euro(TARIFFE.marketing, 4)}, ` +
    `Utility ≈ ${euro(TARIFFE.utility, 4)} a messaggio ` +
    `(tariffe Meta Italia, in vigore dal ${DATA_TARIFFE}).`
  );
}
