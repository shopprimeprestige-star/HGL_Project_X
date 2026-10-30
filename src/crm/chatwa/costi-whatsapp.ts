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
 *   campo `category` di `wa-meta-templates.ts` (diverso per meet_da_fissare e
 *   da_riprogrammare, che Meta ha messo in Marketing). Per questo c'è l'elenco qui.
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
  da_riprogrammare: "marketing",
  meet_da_fissare: "marketing",
  primo_contatto: "utility",
  richiamo_24h: "utility",
  ricontatto_consulenza: "utility",
  ritorno: "utility",
  ultimo_tentativo: "utility",
};

const nomeBase = (nome: string) => nome.replace(/^hgl_/, "").replace(/_v\d+$/, "");

/** Il modello è nell'elenco delle categorie vere? Se no, la cifra è solo una stima. */
export const categoriaConosciuta = (nome: string): boolean =>
  nomeBase(nome) in CATEGORIA_DEI_MODELLI;

/** La categoria di un modello. Se non è nell'elenco vale quella dichiarata dal
 *  modello; senza nemmeno quella, Marketing (la più cara: mai sottostimare). */
export function categoriaModello(
  nome: string,
  dichiarata?: "UTILITY" | "MARKETING",
): CategoriaCosto {
  const nota = CATEGORIA_DEI_MODELLI[nomeBase(nome)];
  if (nota) return nota;
  return dichiarata === "UTILITY" ? "utility" : "marketing";
}

export const prezzoModello = (nome: string, dichiarata?: "UTILITY" | "MARKETING"): number =>
  TARIFFE[categoriaModello(nome, dichiarata)];

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
