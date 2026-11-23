/** ── DAL DATABASE AL PUBBLICO ───────────────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo (T07). Modulo PURO: niente database, niente rete.
 *
 *  `costruisciPubblico(righe, opzioni)` trasforma le righe del catalogo in `ProdottoPubblico[]` (PIANO §3.1).
 *  Le righe sono quelle delle VISTE `shop_v_*` (D1: senza giacenza, con `disponibile`) e, solo per l'anteprima,
 *  quelle delle TABELLE (con la giacenza vera, la `bozza_modifiche`, le note).
 *
 *  ⚠️ L'uscita si COSTRUISCE campo per campo: non si copia mai una riga e non si «toglie» il vietato. Una colonna in più
 *   nel database (o un errore di chi legge) non può quindi arrivare al pubblico. La giacenza si legge solo per dire
 *   `disponibile`, e il numero si ferma qui.
 *  ⚠️ Il filtro «solo pubblicati» c'è anche qui, oltre che nella vista (D1): due difese. La bozza esce soltanto se il
 *   chiamante passa `anteprima: { slug }` DOPO aver verificato la chiave (`anteprima.ts`), e solo per quello slug.
 *  ⚠️ Le colonne si leggono con `righe.ts` (snake_case → tipi del modello): qui non si rifà. Una colonna di filtro
 *   (`stato`, `attiva`, `liberatoria_ok`, `ritrae_persone`, `rimosso_il`) che manca tiene la riga FUORI: vedi `righe.ts`.
 *  ⚠️ D39: Invisible Derm esce SENZA prezzo (`prezzoDaCent` e `prezzoCent` delle varianti `null`, `acquistabile: false`, varianti non
 *   disponibili) e non si scarta per il prezzo: il numero si ferma qui, come la giacenza. Vedi `eInvisibleDerm`.
 *  ⚠️ Righe di forma sbagliata non lanciano: si scartano. Un prezzo che non è un intero positivo scarta la variante
 *   (mai un prezzo inventato). Due foto nello stesso slot: vince una sola, sempre la stessa (`ordine`, poi `id`). */
import {
  SLOT,
  normalizzaCaratteristiche,
  prezzoEffettivo,
  type CampiProdotto,
  type CategoriaPubblica,
  type Media,
  type ProdottoPubblico,
  type SrcFoto,
} from "./modello";
import { categoriaDaRiga, booleano, faq, intero, mediaDaRiga, oggetto, prodottoDaRiga, righeDi, testi, testo, varianteDaRiga } from "./righe";
// ⚠️ Ciclo voluto e innocuo: `vetrina-card` importa `eInvisibleDerm` da qui, noi `cardDaPubblico` da lì. Entrambi si usano solo DENTRO le funzioni
//  (mai mentre il modulo si carica), quindi l'ordine di caricamento non conta; la prova `shop-sezioni2` li impacchetta nei due ordini.
import { cardDaPubblico } from "./vetrina-card";

export interface OpzioniPubblico {
  /** Dove stanno le foto (`…/storage/v1/object/public/shop-media`): si antepone ai percorsi. Senza, restano com'erano. */
  baseMedia?: string;
  /** La chiave d'anteprima è stata verificata per QUESTO indirizzo: la sua bozza esce, con le modifiche non pubblicate. */
  anteprima?: { slug: string };
}

/** D39/D40: Invisible Derm è sempre senza prezzo. LA funzione sola che lo riconosce (elenco, scheda, carrello, CRM e «Prima di pubblicare» la
 *  importano da qui): da qui in poi il prezzo non esiste più nei dati che escono dal server.
 *  Il NOME deve cominciare così (anche «Invisibile Derm», «Invisible-Derm», «InvisibleDerm», «invisible_derm», «Invisible & Derm»), quindi
 *  «Solvente per Invisible Derm» conserva il suo prezzo; oppure lo SLUG comincia con `invisible-derm`.
 *  ⚠️ `invisibi?l[ei]` e non `invisibil[ei]` (come scritto in D40): quest'ultima non riconosce l'inglese «Invisible» (b-l-e, senza la «i»). */
const NOME_INVISIBLE_DERM = /^\s*invisibi?l[ei][\s\-_.\/&]*derm\b(?!atolog)/i;
export const eInvisibleDerm = (nome: unknown, slug?: unknown): boolean =>
  (typeof nome === "string" && NOME_INVISIBLE_DERM.test(nome)) || (typeof slug === "string" && /^\s*invisible-derm/i.test(slug));

const SLOT_PRODOTTO = SLOT.filter((s) => s !== "campione");
/** Come si ordinano le foto nella scheda (Design §4.4.3): la principale, la foto di scala come seconda, le foto 2-5, il video.
 *  Le foto 2-5 stanno TUTTE nello stesso posto: fra loro conta `ordine` (poi `id`), non lo slot, perché il CRM le riordina cambiando solo `ordine`. */
const POSTO: Record<string, number> = { principale: 0, scala: 1, foto2: 2, foto3: 2, foto4: 2, foto5: 2, video: 6, confezione: 7 };
/** Le opzioni si mostrano in quest'ordine: le chiavi di un JSON del database non hanno un ordine affidabile. */
const OPZIONI_NOTE = ["Colore", "Lunghezza", "Misura"];

/** I campi del prodotto che una bozza di modifica può cambiare e che sono pubblici (D27). Il resto della bozza si ignora. */
const CAMPI_DELLA_BOZZA = [
  "nome", "marca", "rigaPresentazione", "descrizioneBreve", "descrizioneLunga", "perChi", "caratteristiche", "passi", "confezione", "avvertenze",
  "faq", "resoConsentito", "resoGiorni", "boxConsulenza", "correlatoId", "seoTitolo", "seoDescrizione", "seoMediaId",
] as const satisfies readonly (keyof CampiProdotto)[];

/** Tra due media dello stesso slot: prima `ordine`, poi `id`. Mai l'ordine in cui sono arrivati. Una regola sola, nel pubblico e in anteprima. */
const prima = (a: Media, b: Media) => a.ordine - b.ordine || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

type Url = (percorso: string | null) => string | null;
/** I percorsi del database → indirizzi completi (con `baseMedia`), o com'erano se non c'è. */
const creaUrl = (baseMedia?: string): Url => {
  const base = baseMedia ? baseMedia.replace(/\/+$/, "") : "";
  return (percorso) => (percorso ? (base ? `${base}/${percorso.replace(/^\/+/, "")}` : percorso) : null);
};
/** Una foto vale solo con tutte e tre le misure. */
const creaFoto = (url: Url) => (m: Media): SrcFoto | null => {
  const w480 = url(m.path480), w960 = url(m.path960), w1600 = url(m.path1600);
  return w480 && w960 && w1600 ? { w480, w960, w1600 } : null;
};

interface Costruito {
  id: string;
  correlatoId: string | null;
  /** Solo i prodotti PUBBLICATI possono essere «correlati» di un altro, anche in anteprima. */
  pubblicato: boolean;
  p: ProdottoPubblico;
}

export function costruisciPubblico(righe: unknown, opzioni: OpzioniPubblico = {}): ProdottoPubblico[] {
  const r = oggetto(righe);
  if (!r) return [];
  const url = creaUrl(opzioni.baseMedia);
  const foto = creaFoto(url);

  const tutteLeVarianti = righeDi(r.varianti).flatMap((x) => varianteDaRiga(x) ?? []);
  const tuttiIMedia = righeDi(r.media).flatMap((x) => mediaDaRiga(x) ?? []);
  // le categorie, quando la riga non le porta già (le viste sì; le tabelle, in anteprima, no)
  const categorieVisibili = new Map(righeDi(r.categorie).flatMap((x) => { const c = categoriaDaRiga(x); return c?.visibile ? [[c.id, { slug: c.slug, nome: c.nome }] as const] : []; }));
  const categorieDi = (riga: Record<string, unknown>, id: string) =>
    Array.isArray(riga.categorie)
      ? righeDi(riga.categorie).flatMap((c) => { const slug = testo(c.slug), nome = testo(c.nome); return slug && nome ? [{ slug, nome }] : []; })
      : righeDi(r.prodottiCategorie).flatMap((l) => (l.prodotto_id === id ? categorieVisibili.get(String(l.categoria_id)) ?? [] : []));

  const costruiti: Costruito[] = [];
  for (const riga of righeDi(r.prodotti)) {
    const prodotto = prodottoDaRiga(riga);
    if (!prodotto) continue;
    const { id, sku, slug } = prodotto;
    const pubblicato = prodotto.stato === "pubblicato";
    const inAnteprima = opzioni.anteprima?.slug === slug && (pubblicato || prodotto.stato === "bozza");
    if (!pubblicato && !inAnteprima) continue;

    // i campi: quelli della riga; in anteprima, con sopra la bozza di modifica (solo i campi dell'elenco)
    const campi: Record<(typeof CAMPI_DELLA_BOZZA)[number], unknown> = Object.fromEntries(CAMPI_DELLA_BOZZA.map((k) => [k, prodotto[k]])) as never;
    const bozza = inAnteprima ? oggetto(prodotto.bozzaModifiche) : null;
    if (bozza) for (const k of CAMPI_DELLA_BOZZA) if (k in bozza) campi[k] = bozza[k];
    const nome = testo(campi.nome);
    if (!nome) continue;

    // D39: Invisible Derm si riconosce dal nome (anche quello nuovo della bozza), dal nome della riga o dallo slug: senza prezzo, non si compra
    const senzaPrezzo = eInvisibleDerm(nome, slug) || eInvisibleDerm(prodotto.nome);

    // le varianti ATTIVE, col prezzo che conta (D25); la giacenza serve solo a dire «disponibile». Quelle spente non contano per niente.
    const varianti = tutteLeVarianti
      .filter((v) => v.prodottoId === id && v.attiva)
      .map((v, i) => ({ v, i }))
      .sort((a, b) => a.v.ordine - b.v.ordine || a.i - b.i)
      .flatMap(({ v }): ProdottoPubblico["varianti"] => {
        if (senzaPrezzo) return [{ sku: v.sku, nome: v.nome || v.sku, opzioni: v.opzioni, prezzoCent: null, disponibile: false }];
        const prezzoCent = prezzoEffettivo(prodotto, v);
        return prezzoCent > 0 ? [{ sku: v.sku, nome: v.nome || v.sku, opzioni: v.opzioni, prezzoCent, disponibile: v.disponibile }] : [];
      });
    const prezzoDaCent = senzaPrezzo ? null : varianti.length ? Math.min(...varianti.map((v) => v.prezzoCent ?? 0)) : prodotto.prezzoCent;
    if (prezzoDaCent !== null && prezzoDaCent <= 0) continue;

    // i media: fuori i rimossi e le persone senza liberatoria (D30); per ogni slot ne vince UNO, sempre lo stesso.
    // Il campione è la pallina di un valore (uno per valore), non una foto del prodotto.
    const candidati = tuttiIMedia.filter((m) => m.prodottoId === id && !m.rimossoIl && !(m.ritraePersone && !m.liberatoriaOk)).sort(prima);
    const scelti = new Map<string, Media>();
    for (const m of candidati) {
      const chiave = m.slot === "campione" ? `campione:${(m.valoreOpzione ?? "").toLowerCase()}` : m.slot;
      if (!scelti.has(chiave)) scelti.set(chiave, m);
    }
    const media = [...scelti.values()]
      .filter((m) => SLOT_PRODOTTO.includes(m.slot as (typeof SLOT_PRODOTTO)[number]))
      .sort((a, b) => POSTO[a.slot] - POSTO[b.slot] || prima(a, b))
      .flatMap((m) => {
        const video = m.slot === "video";
        const src = video ? null : foto(m);
        const file = video ? url(m.pathVideo) : null;
        if (video ? !file : !src) return [];
        return [{
          id: m.id, slot: m.slot as ProdottoPubblico["media"][number]["slot"], sottoRuolo: m.sottoRuolo, alt: m.alt, ordine: m.ordine, src, video: file,
          copertina: video ? url(m.pathCopertina) : null, testoParlato: video ? m.testoParlato : null, muto: m.muto,
        }];
      });
    const campioni = new Map<string, string>();
    for (const m of scelti.values()) {
      const w480 = url(m.path480);
      if (m.slot === "campione" && m.valoreOpzione && w480) campioni.set(m.valoreOpzione.toLowerCase(), w480);
    }

    // le opzioni: dai valori delle varianti attive; il campione c'è solo dove c'è la foto
    const nomiOpzione = [...new Set(varianti.flatMap((v) => Object.keys(v.opzioni)))].sort(
      (a, b) => (OPZIONI_NOTE.indexOf(a) + 1 || 99) - (OPZIONI_NOTE.indexOf(b) + 1 || 99),
    );
    const opzioniPubbliche = nomiOpzione.map((n) => ({
      nome: n,
      valori: [...new Set(varianti.flatMap((v) => v.opzioni[n] ?? []))].map((valore) => ({
        valore,
        campione: campioni.has(valore.toLowerCase()) ? { w480: campioni.get(valore.toLowerCase())! } : null,
      })),
    }));

    const caratteristiche = normalizzaCaratteristiche(campi.caratteristiche);
    const principale = media.find((m) => m.slot === "principale");
    const seoFoto = media.find((m) => m.id === campi.seoMediaId)?.src ?? principale?.src ?? null;

    const pubblico: ProdottoPubblico = {
      sku, slug, nome, marca: testo(campi.marca), tipo: prodotto.tipo, rigaPresentazione: testo(campi.rigaPresentazione),
      descrizioneBreve: testo(campi.descrizioneBreve) ?? "", descrizioneLunga: testo(campi.descrizioneLunga), perChi: testo(campi.perChi),
      caratteristiche: caratteristiche.filter((x) => x.stato === "confermato").map(({ etichetta, valore }) => ({ etichetta, valore })),
      passi: testi(campi.passi), confezione: testi(campi.confezione), avvertenze: testi(campi.avvertenze), faq: faq(campi.faq),
      categorie: categorieDi(riga, id), media, opzioni: opzioniPubbliche, varianti,
      prezzoDaCent, acquistabile: !senzaPrezzo, reso: { consentito: booleano(campi.resoConsentito), giorni: intero(campi.resoGiorni) }, boxConsulenza: campi.boxConsulenza === true,
      correlato: null, seo: { titolo: testo(campi.seoTitolo), descrizione: testo(campi.seoDescrizione), immagine: seoFoto?.w1600 ?? null },
      gtin: prodotto.gtin, aggiornatoIl: prodotto.aggiornatoIl,
    };

    if (inAnteprima) {
      const nascosti: { blocco: string; motivo: string }[] = [];
      const daConfermare = caratteristiche.filter((x) => x.stato !== "confermato").length;
      if (daConfermare) nascosti.push({ blocco: "caratteristiche", motivo: `${daConfermare} ${daConfermare === 1 ? "riga" : "righe"} da confermare` });
      if (!principale) nascosti.push({ blocco: "foto principale", motivo: "slot vuoto" });
      const senzaLiberatoria = tuttiIMedia.filter((m) => m.prodottoId === id && !m.rimossoIl && m.ritraePersone && !m.liberatoriaOk).length;
      if (senzaLiberatoria) nascosti.push({ blocco: "foto", motivo: `${senzaLiberatoria} foto senza liberatoria` });
      if (!prodotto.classeSpedizione && !((prodotto.pesoG ?? 0) > 0)) nascosti.push({ blocco: "spedizione", motivo: "manca la spedizione" });
      pubblico.anteprima = { nascosti };
    }
    costruiti.push({ id, correlatoId: testo(campi.correlatoId), pubblicato, p: pubblico });
  }

  // «Ti serve anche»: uno solo, pubblicato, diverso da sé
  for (const x of costruiti) {
    const altro = costruiti.find((y) => y.id === x.correlatoId && y.pubblicato && y.id !== x.id);
    if (altro) {
      // «si compra con un clic» e «Da»: la regola è quella della card del collegato (`cardDaPubblico`), mai riscritta qui
      const card = cardDaPubblico(altro.p);
      const sku = card.aggiungibile ? (card.skuVarianti[0] ?? null) : null;
      x.p.correlato = {
        slug: altro.p.slug, nome: altro.p.nome, prezzoDaCent: altro.p.prezzoDaCent, foto: altro.p.media.find((m) => m.slot === "principale")?.src ?? null,
        sku, prezziDiversi: card.prezziDiversi, aggiungibile: sku !== null,
      };
    }
  }
  return costruiti.map((x) => x.p);
}

/**
 * Le categorie pubbliche (PIANO §3.1 `CategoriaPubblica`): solo `visibile` e con almeno un prodotto pubblicato (`quanti`,
 * che calcola la vista `shop_v_categorie`; senza un numero > 0 la categoria non esiste). La foto è la «principale» di quella
 * categoria (stessa scelta e stessi filtri dei prodotti), solo se ha le tre misure; l'alt è della stessa riga (D36). Ordine: `ordine`, poi nome.
 */
export function costruisciCategorie(righe: unknown, opzioni: { baseMedia?: string } = {}): CategoriaPubblica[] {
  const r = oggetto(righe);
  if (!r) return [];
  const foto = creaFoto(creaUrl(opzioni.baseMedia));
  const media = righeDi(r.media).flatMap((x) => mediaDaRiga(x) ?? []).filter((m) => m.slot === "principale" && !m.rimossoIl && !(m.ritraePersone && !m.liberatoriaOk)).sort(prima);
  return righeDi(r.categorie)
    .flatMap((riga) => {
      const c = categoriaDaRiga(riga), quanti = intero(riga.quanti);
      return c && c.visibile && quanti !== null && quanti > 0 ? [{ c, quanti }] : [];
    })
    .sort((a, b) => a.c.ordine - b.c.ordine || a.c.nome.localeCompare(b.c.nome))
    .map(({ c, quanti }) => {
      const m = media.find((x) => x.categoriaId === c.id);
      const src = m ? foto(m) : null; // foto e alt sono della STESSA riga (D36): senza le tre misure non c'è nessuno dei due
      return {
        slug: c.slug, nome: c.nome, tipo: c.tipo, frase: c.frase, foto: src, fotoAlt: src && m ? m.alt : null,
        seo: { titolo: c.seoTitolo, descrizione: c.seoDescrizione }, ordine: c.ordine, quanti,
      };
    });
}
