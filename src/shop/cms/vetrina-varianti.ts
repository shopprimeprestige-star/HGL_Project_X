/** ── VETRINA V1 · T78 · LA SCELTA DELLA VARIANTE (parte pura) ────────────────
 *  Cosa deve valere (SPEC §4.5.4 n. 3-4, V1-S3, V1-S4):
 *   · il colore è a campioni a cerchio con la foto vera del campione; senza campione c'è la PRIMA LETTERA, mai un colore inventato;
 *   · premendo «Aggiungi» senza aver scelto, il fuoco va alla scelta mancante con un messaggio accanto: il bottone NON è mai
 *     disabilitato per questo. Il solo bottone disabilitato è «Esaurito» (variante scelta ed esaurita, o prodotto tutto esaurito);
 *   · una variante esaurita porta la parola «Esaurito» nell'etichetta accessibile (oltre alla diagonale).
 *  Qui si decide COSA e DOVE, mai la frase: `messaggioMancante` dà la chiave del testo, che le pagine cercano in `testi-shop.ts`.
 *  Fuoco vero e `aria-live` sono [M]/[T] (D103). Nessun React: la prova lo gira senza browser. Disegno: `SelettoreVariante.tsx` (T87a). */
import { TESTI_SHOP } from "@/landing/testi-shop";
import { varianteDaOpzioni } from "./adattatore";
import type { ProdottoPubblico } from "./modello";

type Opzioni = ProdottoPubblico["opzioni"];
type Variante = ProdottoPubblico["varianti"][number];
/** Le scelte del cliente: nome dell'opzione → valore. Un'opzione non ancora scelta non c'è. */
export type Scelta = Record<string, string>;

/** Il nome di un'opzione come chiave: minuscolo e senza accenti («Lunghézza» → «lunghezza»). */
const chiaveDi = (nome: string): string => nome.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export interface CampioneColore {
  valore: string;
  /** La foto vera del campione (480 px), o `null`: allora il cerchio mostra la `lettera` su fondo notte. */
  campione: { w480: string } | null;
  lettera: string;
}

/** I campioni dell'opzione «Colore» (nessun maiuscolo che conti): senza quell'opzione, nessuno. Gli altri gruppi sono pillole. */
export function campioniColore(opzioni: Opzioni | null | undefined): CampioneColore[] {
  const colore = (Array.isArray(opzioni) ? opzioni : []).find((o) => chiaveDi(o.nome) === "colore");
  return (colore?.valori ?? []).map((v) => ({
    valore: v.valore,
    campione: v.campione,
    lettera: [...v.valore.trim()][0]?.toLocaleUpperCase("it") ?? "",
  }));
}

/** La prima opzione (nell'ordine dei dati) che il cliente non ha ancora scelto, o `null` se ha scelto tutto. Un valore che non c'è più vale come non scelto.
 *  `chiave` è il testo del messaggio («Scegli il colore.»), da cercare in `testi-shop.ts` sotto `scheda.scegli.<opzione>`. */
export function messaggioMancante(opzioni: Opzioni | null | undefined, scelta: Scelta | null | undefined): { opzione: string; chiave: string } | null {
  const manca = (Array.isArray(opzioni) ? opzioni : []).find((o) => !o.valori.some((v) => v.valore === scelta?.[o.nome]));
  return manca ? { opzione: manca.nome, chiave: `scheda.scegli.${chiaveDi(manca.nome)}` } : null;
}

/** La variante che ha ESATTAMENTE queste scelte (una regola sola: `varianteDaOpzioni`), o `null`. */
export function skuScelto(p: ProdottoPubblico, scelta: Scelta | null | undefined): string | null {
  return varianteDaOpzioni(p, scelta as Scelta);
}

export function varianteScelta(p: ProdottoPubblico, scelta: Scelta | null | undefined): Variante | null {
  const sku = skuScelto(p, scelta);
  return p.varianti.find((v) => v.sku === sku) ?? null;
}

/** Cosa dice il bottone: `aggiungi` o `esaurito`. Senza una variante scelta è «aggiungi» (e il clic porta alla scelta mancante): MAI disabilitato per questo.
 *  Se nessuna variante del prodotto è disponibile (`varianti`), è `esaurito` anche senza scelta. Solo `esaurito` si disabilita.
 *  ⚠️ Invisible Derm non ha nessuna variante disponibile: la scheda non deve montare questo bottone (`acquistabile` falso). */
export function statoBottone(scelta: { disponibile: boolean } | null | undefined, varianti: readonly { disponibile: boolean }[] = []): "aggiungi" | "esaurito" {
  if (scelta) return scelta.disponibile ? "aggiungi" : "esaurito";
  return varianti.length > 0 && varianti.every((v) => !v.disponibile) ? "esaurito" : "aggiungi";
}

/** L'etichetta accessibile di un campione o di una pillola: il valore e, se esaurito, la parola «Esaurito» (V1-S4). */
export function etichettaCampione(valore: string, esaurito: boolean): string {
  return esaurito ? `${valore}, ${TESTI_SHOP.scheda.esaurito}` : valore;
}

/** `valore` dell'opzione `nome` è esaurito, date le ALTRE scelte già fatte? Esaurito = nessuna variante disponibile con quel valore e quelle scelte
 *  (la scelta dello stesso gruppo non conta: ogni colore si guarda con le altre scelte). Un valore che nessuna variante ha vale esaurito: non si compra. */
export function valoreEsaurito(p: ProdottoPubblico, nome: string, valore: string, scelta: Scelta | null | undefined): boolean {
  const altre = Object.entries(scelta ?? {}).filter(([k]) => k !== nome);
  return !p.varianti.some((v) => v.disponibile && v.opzioni[nome] === valore && altre.every(([k, x]) => v.opzioni[k] === x));
}
