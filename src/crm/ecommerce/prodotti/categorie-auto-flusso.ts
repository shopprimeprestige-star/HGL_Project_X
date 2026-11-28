/** ── «METTI LE CATEGORIE»: LE LETTURE E LE SCRITTURE (categorie-auto-flusso.ts) ─────────
 *  Commessa 2026-11-25-editor-prodotti, E16. Senza schermo: riceve le «porte» (le azioni del negozio, già esistenti) e si prova con un server finto.
 *  Le regole di cosa proporre e cosa scrivere sono in `categorie-auto.ts`; la finestra è `FinestraCategorieAuto.tsx`.
 *
 *  ── LE REGOLE ───────────────────────────────────────────────────────────────
 *  · Niente richieste a raffica: i prodotti si fanno a GRUPPI di 5 (uno dopo l'altro, dentro il gruppo insieme); ogni prodotto fa le sue richieste
 *    in fila (lettura, categorie, poi i campi). Mai 82 richieste insieme.
 *  · Le categorie nuove si creano PRIMA dei prodotti, una volta sola ciascuna, con l'azione `categoria_salva` (nascoste, come oggi). Prima di creare
 *    si rilegge l'elenco: una categoria che c'è già (anche nata nel frattempo, anche con un altro indirizzo) non si ricrea.
 *  · Le categorie di un prodotto si AGGIUNGONO: `prodotto_categorie` riceve l'insieme di prima più la nuova (l'azione sostituisce l'insieme, quindi
 *    l'insieme completo lo scriviamo noi). Chi ha già la categoria non riceve nessuna scrittura.
 *  · Ogni prodotto si rilegge prima di scrivere (versione e campi di adesso): ciò che è già pieno non si sovrascrive, e riprovare non rifà niente.
 *  · Un errore di un prodotto non ferma gli altri; un errore che fermerebbe tutto (sessione, permesso, rete) ferma dopo il gruppo in corso, e il
 *    resto non parte. «Riprova» rifà solo i mancanti (errori e mai partiti): chi è fatto non si tocca.
 *  ⚠️ Nessun log da qui, mai. */
import type { RisultatoAzione, RisultatoDati, RisultatoScheda } from "@/crm/negozio/client";
import type { Voce } from "@/shop/cms/pubblicazione";
import {
  CATEGORIE_AUTO,
  categorieDaCreare,
  decidi,
  leggiProdotto,
  restaAMano,
  trovaCategoria,
  type CategoriaNota,
  type Lettura,
  type Opzioni,
} from "./categorie-auto";

/** Quanti prodotti si fanno insieme (e, nell'anteprima, quante schede si leggono insieme). */
export const GRUPPO = 5;
/** Il «per cento» della barra (la costante, come nell'import: i file di prodotti/ non moltiplicano per 100 «a vista»). */
export const CENTO = 100;
/** Gli errori dopo i quali provare con i prodotti dopo è inutile: si ferma (come l'elenco). */
const FERMANO = ["sessione", "permesso", "migrazione", "rete"];

export interface Porte {
  esegui: (azione: string, dati?: Record<string, unknown>) => Promise<RisultatoAzione>;
  scheda: (id: string) => Promise<RisultatoScheda>;
  categorie: () => Promise<RisultatoDati>;
}
/** Un prodotto scelto e la categoria (indirizzo) che gli si vuole dare; `null` = nessuna. */
export interface Scelta {
  id: string;
  nome: string;
  categoria: string | null;
}

const eOggetto = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const FRASE_FORMA =
  "Il server ha risposto in un modo che non capisco: ricarica la pagina e riprova.";

/** Chi non ha niente da fare (nessuna categoria scelta, nessuna opzione) non si tocca e non si conta. */
const servono = (s: Scelta, opz: Opzioni) => s.categoria !== null || opz.breve || opz.sito;

/** Cinque elementi alla volta: un gruppo parte quando il precedente è finito. `ferma` dice se fermarsi (dopo il gruppo in corso). */
async function aGruppi<T>(
  elementi: readonly T[],
  fa: (x: T) => Promise<unknown>,
  ferma: () => boolean = () => false,
): Promise<void> {
  for (let i = 0; i < elementi.length && !ferma(); i += GRUPPO)
    await Promise.all(elementi.slice(i, i + GRUPPO).map(fa));
}

/* ══ LA LETTURA PER L'ANTEPRIMA ═════════════════════════════════════════════ */

export type LetturaProdotto = { ok: true; lettura: Lettura } | { ok: false; frase: string };

async function leggiUno(
  porte: Porte,
  id: string,
): Promise<{ esito: LetturaProdotto; ferma: boolean }> {
  const r = await porte.scheda(id);
  if (!r.ok)
    return {
      esito: { ok: false, frase: r.errore.messaggio },
      ferma: FERMANO.includes(r.errore.tipo),
    };
  const lettura = leggiProdotto(r.scheda);
  return lettura
    ? { esito: { ok: true, lettura }, ferma: false }
    : { esito: { ok: false, frase: FRASE_FORMA }, ferma: false };
}

/** Legge le schede a gruppi di 5. Un prodotto che non si legge ha la sua frase e gli altri vanno; dopo un errore che ferma, chi non è stato letto ha la stessa frase. */
export async function leggiTutti(
  porte: Porte,
  ids: readonly string[],
  avanza?: (letti: number, totale: number) => void,
): Promise<Record<string, LetturaProdotto>> {
  const letti: Record<string, LetturaProdotto> = {};
  let fermo: string | null = null;
  await aGruppi(
    [...new Set(ids)],
    async (id) => {
      const { esito, ferma } = await leggiUno(porte, id);
      letti[id] = esito;
      if (ferma && !esito.ok) fermo = esito.frase;
      avanza?.(Object.keys(letti).length, new Set(ids).size);
    },
    () => fermo !== null,
  );
  for (const id of ids) letti[id] ??= { ok: false, frase: fermo ?? FRASE_FORMA };
  return letti;
}

/* ══ LA CORSA: LE SCRITTURE ═════════════════════════════════════════════════ */

export interface Esito {
  stato: "fatto" | "errore";
  /** La frase del server, solo se `errore`. */
  frase?: string;
  /** Cosa è stato scritto (anche da un tentativo prima: un errore dopo la categoria non la cancella). */
  categoria: boolean;
  breve: boolean;
  sito: boolean;
  /** Quello che dopo questo lavoro resta bloccante e va fatto a mano (la foto, per esempio). */
  resto: Voce[];
}
/** Tutto quello che una corsa sa. Si passa uguale a ogni «Riprova»: per questo non si creano due volte le categorie e non si rifà ciò che è fatto. */
export interface Corsa {
  /** I prodotti da fare (quelli con qualcosa da scrivere). */
  ids: string[];
  /** Indirizzo → id delle categorie che si sono trovate o create. */
  categorie: Record<string, string>;
  /** Gli indirizzi creati in questa corsa, in ordine. */
  create: string[];
  /** Una categoria che non si è riusciti a creare, con la frase. */
  errCategorie: Record<string, string>;
  esiti: Record<string, Esito>;
  /** La frase dell'errore che ha fermato tutto, o `null`. */
  fermo: string | null;
}
export const corsaVuota = (): Corsa => ({
  ids: [],
  categorie: {},
  create: [],
  errCategorie: {},
  esiti: {},
  fermo: null,
});

const noteDa = (dati: Record<string, unknown>): CategoriaNota[] =>
  (Array.isArray(dati.categorie) ? dati.categorie : []).flatMap((k) =>
    eOggetto(k) &&
    typeof k.id === "string" &&
    typeof k.slug === "string" &&
    typeof k.nome === "string"
      ? [{ id: k.id, slug: k.slug, nome: k.nome }]
      : [],
  );

/** Le categorie che servono: quelle che ci sono si prendono (anche con altro indirizzo), le altre si creano UNA volta, nascoste. */
async function preparaCategorie(
  porte: Porte,
  slugs: readonly (string | null)[],
  corsa: Corsa,
): Promise<Corsa> {
  const voluti = slugs.filter((s): s is string => s !== null);
  if (voluti.length === 0) return corsa;
  const letta = await porte.categorie();
  if (!letta.ok) return { ...corsa, fermo: letta.errore.messaggio };
  let note = noteDa(letta.dati);
  let c = corsa;
  const trovate = (s: string) => {
    const k = trovaCategoria(s, note);
    if (k) c = { ...c, categorie: { ...c.categorie, [s]: k.id } };
    return k;
  };
  voluti.forEach(trovate);
  for (const k of categorieDaCreare(voluti, note)) {
    const r = await porte.esegui("categoria_salva", { nome: k.nome, slug: k.slug });
    const id =
      r.ok && eOggetto(r.dati.categoria) && typeof r.dati.categoria.id === "string"
        ? r.dati.categoria.id
        : null;
    if (id) {
      c = { ...c, categorie: { ...c.categorie, [k.slug]: id }, create: [...c.create, k.slug] };
      continue;
    }
    if (!r.ok && r.errore.tipo === "duplicato") {
      // «l'indirizzo è già usato»: l'ha creata qualcun altro un attimo fa. Si rilegge e si usa quella.
      const di_nuovo = await porte.categorie();
      if (di_nuovo.ok) note = noteDa(di_nuovo.dati);
      if (trovate(k.slug)) continue;
    }
    c = {
      ...c,
      errCategorie: { ...c.errCategorie, [k.slug]: r.ok ? FRASE_FORMA : r.errore.messaggio },
    };
    if (!r.ok && FERMANO.includes(r.errore.tipo)) return { ...c, fermo: r.errore.messaggio };
  }
  return c;
}

/** Un prodotto: lo rilegge, aggiunge la categoria, riempie i campi vuoti. Le richieste vanno in fila e ognuna usa la versione che ha dato la precedente. */
async function faiProdotto(
  porte: Porte,
  s: Scelta,
  opz: Opzioni,
  corsa: Corsa,
): Promise<{ esito: Esito; ferma: boolean }> {
  const prima = corsa.esiti[s.id];
  const base = {
    categoria: prima?.categoria ?? false,
    breve: prima?.breve ?? false,
    sito: prima?.sito ?? false,
    resto: prima?.resto ?? [],
  };
  const errore = (frase: string, tipo = ""): { esito: Esito; ferma: boolean } => ({
    esito: { ...base, stato: "errore", frase },
    ferma: FERMANO.includes(tipo),
  });

  const r = await porte.scheda(s.id);
  if (!r.ok) return errore(r.errore.messaggio, r.errore.tipo);
  const l = leggiProdotto(r.scheda);
  if (!l) return errore(FRASE_FORMA);
  const idCategoria = s.categoria ? (corsa.categorie[s.categoria] ?? null) : null;
  if (s.categoria && !idCategoria)
    return errore(
      corsa.errCategorie[s.categoria] ?? "Questa categoria non si è potuta creare: riprova.",
    );

  const d = decidi(l, idCategoria, opz);
  const fatto = { ...base, resto: restaAMano(l, d) };
  let versione = l.versione;
  if (d.aggiungi.length) {
    // l'azione SOSTITUISCE l'insieme: si manda quello di prima più la nuova, mai meno
    const x = await porte.esegui("prodotto_categorie", {
      prodottoId: s.id,
      categorie: [...l.categorie, ...d.aggiungi],
      versione,
    });
    if (!x.ok) return errore(x.errore.messaggio, x.errore.tipo);
    if (typeof x.dati.versione === "string") versione = x.dati.versione;
    fatto.categoria = true;
  }
  if (d.breve !== null || d.sito) {
    const campi = {
      ...(d.breve !== null ? { descrizioneBreve: d.breve } : {}),
      ...(d.sito ? { canali: { ...l.canali, sito: true } } : {}),
    };
    const x = await porte.esegui("prodotto_salva", { prodottoId: s.id, versione, campi });
    if (!x.ok)
      return {
        esito: { ...fatto, stato: "errore", frase: x.errore.messaggio },
        ferma: FERMANO.includes(x.errore.tipo),
      };
    fatto.breve = fatto.breve || d.breve !== null;
    fatto.sito = fatto.sito || d.sito;
  }
  return { esito: { ...fatto, stato: "fatto" }, ferma: false };
}

export interface OpzioniCorsa {
  /** Dopo ogni prodotto: la corsa com'è ora (per la barra). */
  aggiorna?: (corsa: Corsa) => void;
  /** `true` = ferma dopo il gruppo in corso (la finestra è sparita). */
  interrompi?: () => boolean;
}

/** Fa (o riprende) il lavoro: tutti i prodotti con qualcosa da scrivere che non sono già «fatti». */
export async function applica(
  porte: Porte,
  scelte: readonly Scelta[],
  opz: Opzioni,
  corsa0: Corsa,
  opzioni: OpzioniCorsa = {},
): Promise<Corsa> {
  const lavoro = scelte.filter((s) => servono(s, opz));
  let corsa: Corsa = {
    ...corsa0,
    fermo: null,
    ids: [...new Set([...corsa0.ids, ...lavoro.map((s) => s.id)])],
  };
  const da = lavoro.filter((s) => corsa.esiti[s.id]?.stato !== "fatto");
  if (da.length === 0) return corsa;

  corsa = await preparaCategorie(
    porte,
    da.map((s) => s.categoria),
    corsa,
  );
  opzioni.aggiorna?.(corsa);
  if (corsa.fermo) return corsa;

  await aGruppi(
    da,
    async (s) => {
      const { esito, ferma } = await faiProdotto(porte, s, opz, corsa);
      corsa = {
        ...corsa,
        esiti: { ...corsa.esiti, [s.id]: esito },
        fermo: ferma && esito.frase ? esito.frase : corsa.fermo,
      };
      opzioni.aggiorna?.(corsa);
    },
    () => corsa.fermo !== null || opzioni.interrompi?.() === true,
  );
  return corsa;
}

/* ══ COSA SI VEDE ═══════════════════════════════════════════════════════════ */

export interface Avanzamento {
  fatti: number;
  totale: number;
  errori: number;
  /** 0–100: i prodotti FATTI sul totale (chi è in errore non conta: la barra non finge). */
  percento: number;
}
export function avanzamento(corsa: Corsa): Avanzamento {
  const totale = corsa.ids.length;
  const e = corsa.ids.map((id) => corsa.esiti[id]?.stato);
  const fatti = e.filter((x) => x === "fatto").length;
  return {
    fatti,
    totale,
    errori: e.filter((x) => x === "errore").length,
    percento: totale ? Math.floor((fatti * CENTO) / totale) : 0,
  };
}

/** I prodotti da rifare: quelli in errore e quelli mai partiti (dopo un errore che ha fermato tutto). */
export const mancanti = (scelte: readonly Scelta[], corsa: Corsa): Scelta[] =>
  scelte.filter((s) => corsa.ids.includes(s.id) && corsa.esiti[s.id]?.stato !== "fatto");

export interface Riepilogo {
  categorie: number;
  breve: number;
  sito: number;
  errori: { nome: string; frase: string }[];
  /** I nomi delle categorie create in questa corsa. */
  nomiCreate: string[];
  /** Quello che resta da fare a mano, un elenco di voci per prodotto fatto. */
  resto: Voce[][];
}
export function riepilogo(scelte: readonly Scelta[], corsa: Corsa): Riepilogo {
  const esiti = corsa.ids.flatMap((id) => (corsa.esiti[id] ? [corsa.esiti[id]] : []));
  return {
    categorie: esiti.filter((e) => e.categoria).length,
    breve: esiti.filter((e) => e.breve).length,
    sito: esiti.filter((e) => e.sito).length,
    errori: scelte.flatMap((s) =>
      corsa.esiti[s.id]?.stato === "errore"
        ? [{ nome: s.nome, frase: corsa.esiti[s.id].frase ?? FRASE_FORMA }]
        : [],
    ),
    nomiCreate: corsa.create.map(
      (slug) => CATEGORIE_AUTO.find((k) => k.slug === slug)?.nome ?? slug,
    ),
    resto: esiti.filter((e) => e.stato === "fatto").map((e) => e.resto),
  };
}
