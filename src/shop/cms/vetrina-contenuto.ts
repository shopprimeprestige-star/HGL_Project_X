/** ── IL CONTENUTO DELLO SHOP: REGOLE PURE E LETTORE CON MEMORIA ─────────────
 *  Commessa 2026-11-20-shop-completo, V1 · T80 (PIANO-V1 D76, D77). Modulo senza server né browser dentro: si prova con un finto client.
 *  La riga `landing_content`/`default` è della landing intera (hero, recensioni, Invisible Derm…): dello shop esce SOLO ciò che comincia per
 *  `shop.` (testi e media), mai il resto. Quello che esce sono i valori SALVATI dal titolare; i testi di partenza si aggiungono qui (`testiDi`),
 *  così un guasto del database dà la vetrina coi testi di partenza e gli slot vuoti (hero a una colonna), mai un errore.
 *  ⚠️ Un testo svuotato nel CRM resta vuoto (non torna quello di partenza): la riga non si disegna (V1-T16). Un testo con `{{…}}` non si disegna.
 *  ⚠️ I testi confermati (`shop.conf.*`: reso, assistenza…) hanno UNA porta sola, `confermatiDa`, che passa per `filtraConfermati` (D77). */
import { ALT_SHOP, CAMPI_TESTO_SHOP, SLOT_SHOP, liberatoriaOk } from "@/landing/testi-shop";
import { CHIAVI_TESTI, filtraConfermati, type TestiConfermati } from "./testi-confermati";

/** Ciò che il server dà alle pagine: i valori salvati con chiave `shop.*`, e basta. */
export interface ContenutoShop {
  testi: Record<string, string>;
  media: Record<string, string>;
}

/** Un oggetto nuovo ogni volta: nessuno può sporcare quello degli altri. */
export const contenutoVuoto = (): ContenutoShop => ({ testi: {}, media: {} });

/** Di un elenco chiave→valore tiene le sole chiavi `shop.` con un testo come valore. */
export function soloShop(raw: unknown): Record<string, string> {
  const fuori: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fuori;
  for (const [k, v] of Object.entries(raw)) if (k.startsWith("shop.") && typeof v === "string") fuori[k] = v;
  return fuori;
}

/** Dalla colonna `data` della riga della landing: solo i testi e i media dello shop. Riga assente o storta = vuoto. */
export function contenutoDaRiga(data: unknown): ContenutoShop {
  if (!data || typeof data !== "object" || Array.isArray(data)) return contenutoVuoto();
  const r = data as { texts?: unknown; media?: unknown };
  return { testi: soloShop(r.texts), media: soloShop(r.media) };
}

/** Un testo da mostrare: senza spazi ai lati; vuoto o con un segnaposto `{{…}}` aperto = `null` (la riga non si disegna). */
function testoPulito(v: unknown): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t !== "" && !t.includes("{{") ? t : null;
}

/** Un indirizzo di foto o video: `http(s)://…` o un percorso del sito (`/…`, mai `//`). Niente `javascript:`, `data:`, segnaposto. */
function indirizzoPulito(v: unknown): string | null {
  const t = testoPulito(v);
  return t !== null && /^(?:https?:\/\/\S+|\/(?!\/)\S*)$/i.test(t) ? t : null;
}

/** I testi di partenza di ogni campo di testo dell'editor (i confermati no: partono vuoti e hanno la loro porta) e le descrizioni (alt). */
const PARTENZA: Record<string, string> = {
  ...Object.fromEntries(CAMPI_TESTO_SHOP.filter((x) => !x.chiave.startsWith("shop.conf.")).map((x) => [x.chiave, x.default])),
  ...ALT_SHOP,
};

/** Tutti i testi di pagina dello shop pronti da disegnare: il valore salvato, o quello di partenza se non c'è mai stato scritto nulla.
 *  `null` = la riga non si disegna (svuotato, solo spazi, o con `{{`). Ogni chiave dell'editor c'è sempre. */
export function testiDi(contenuto: unknown): Record<string, string | null> {
  const salvati = soloShop((contenuto as { testi?: unknown } | null | undefined)?.testi);
  const fuori: Record<string, string | null> = {};
  for (const [k, partenza] of Object.entries(PARTENZA)) fuori[k] = testoPulito(Object.hasOwn(salvati, k) ? salvati[k] : partenza);
  return fuori;
}

/** L'indirizzo di ogni slot media di V1 (`SLOT_SHOP`), o `null` se vuoto o non usabile. Senza niente di salvato sono tutti `null`. */
export function mediaDi(contenuto: unknown): Record<string, string | null> {
  const salvati = soloShop((contenuto as { media?: unknown } | null | undefined)?.media);
  const fuori: Record<string, string | null> = {};
  for (const s of SLOT_SHOP) fuori[s.chiave] = indirizzoPulito(salvati[s.chiave]);
  return fuori;
}

/** Foto o video pronto da disegnare, oppure `null`. Serve l'indirizzo E la descrizione per chi non vede.
 *  `liberatoria`: per un media con persone passare il valore di `shop.clienti.liberatoria` (da `testiDi`): senza un «sì» scritto non si disegna
 *  (anche se è vuoto o `null`). Per un media senza persone non si passa (`undefined`). */
export function slotUsabile(url: unknown, alt: unknown, liberatoria?: unknown): { src: string; alt: string } | null {
  const src = indirizzoPulito(url);
  const descrizione = testoPulito(alt);
  if (!src || !descrizione) return null;
  if (liberatoria !== undefined && !(typeof liberatoria === "string" && liberatoriaOk(liberatoria))) return null;
  return { src, alt: descrizione };
}

/** I sei testi confermati dal titolare (D63, D77): le chiavi `shop.conf.<chiave>` del contenuto, senza prefisso, per `filtraConfermati`.
 *  Una chiave senza il prefisso, o che non è in `CHIAVI_TESTI`, non passa. */
export function confermatiDa(contenuto: unknown): TestiConfermati {
  const salvati = soloShop((contenuto as { testi?: unknown } | null | undefined)?.testi);
  const grezzi: Record<string, string> = {};
  for (const k of CHIAVI_TESTI) if (Object.hasOwn(salvati, `shop.conf.${k}`)) grezzi[k] = salvati[`shop.conf.${k}`];
  return filtraConfermati(grezzi);
}

/** La parte del client Supabase che serve (il finto delle prove ha lo stesso aspetto). */
export interface ClienteContenuto {
  from(tabella: string): {
    select(colonne: string): {
      eq(colonna: string, valore: string): {
        maybeSingle(): PromiseLike<{ data: { data?: unknown } | null; error: unknown }>;
      };
    };
  };
}
export interface PorteContenuto {
  db: ClienteContenuto;
  /** Millisecondi (`Date.now()`); le prove usano un orologio finto. */
  adesso: () => number;
  /** Per quanto si tiene la lettura; 0 = mai (il collaudo). Di partenza 30 s. */
  memoriaMs?: number;
  /** Solo CODICI. */
  log?: (codice: string) => void;
}
export interface LetturaContenuto {
  contenuto: ContenutoShop;
  /** `true` = il database non ha risposto: contenuto vuoto, e la risposta non si tiene da nessuna parte. */
  guasto: boolean;
}

export const MEMORIA_CONTENUTO_MS = 30_000;

/** Il lettore: una lettura della riga `landing_content`/`default`, tenuta in memoria per 30 s. Mai un'eccezione: un guasto è `{vuoto, guasto:true}`,
 *  non si tiene in memoria (la chiamata dopo riprova). Una riga che non c'è NON è un guasto: la landing non è mai stata salvata. */
export function creaLettoreContenuto(porte: PorteContenuto): () => Promise<LetturaContenuto> {
  const memoriaMs = porte.memoriaMs ?? MEMORIA_CONTENUTO_MS;
  let tenuto: { fino: number; contenuto: ContenutoShop } | null = null;
  const segnala = (e: unknown) => {
    const codice = (e as { code?: unknown } | null)?.code;
    const t = String(typeof codice === "string" || typeof codice === "number" ? codice : "errore");
    porte.log?.(/^[A-Za-z0-9_.:-]{1,40}$/.test(t) ? t : "errore");
  };
  // chi legge riceve una copia: se la modifica, la lettura dopo (dalla memoria) non cambia
  const copia = (c: ContenutoShop): ContenutoShop => ({ testi: { ...c.testi }, media: { ...c.media } });
  return async () => {
    const ora = porte.adesso();
    if (tenuto && ora < tenuto.fino) return { contenuto: copia(tenuto.contenuto), guasto: false };
    try {
      const r = await porte.db.from("landing_content").select("data").eq("id", "default").maybeSingle();
      if (r.error) {
        segnala(r.error);
        return { contenuto: contenutoVuoto(), guasto: true };
      }
      const contenuto = contenutoDaRiga(r.data?.data);
      tenuto = memoriaMs > 0 ? { fino: ora + memoriaMs, contenuto } : null;
      return { contenuto: copia(contenuto), guasto: false };
    } catch (e) {
      segnala(e);
      return { contenuto: contenutoVuoto(), guasto: true };
    }
  };
}
