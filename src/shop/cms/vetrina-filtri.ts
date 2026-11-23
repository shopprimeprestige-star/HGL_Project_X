/** ── VETRINA V1 · T77 · I FILTRI DELLA CATEGORIA (D80) ────────────────────────
 *  Funzioni pure: niente React, niente rete, niente schermo. Lavorano sui `ProdottoPubblico` PUBBLICATI che il server ha già
 *  mandato (una bozza non arriva mai fin qui) e sullo stato che sta nell'indirizzo (`?colore=castano,nero&misura=m&disp=1`).
 *  ⚠️ I gruppi nascono dalle opzioni che le VARIANTI usano davvero: un'opzione scritta nel prodotto ma che nessuna variante usa
 *   non è un filtro (V1-C2: «solo filtri che esistono»). «Disponibile» c'è solo se esistono varianti disponibili e non.
 *  ⚠️ Un prodotto passa se UNA sua variante soddisfa TUTTI i gruppi attivi insieme (e, con «Disponibile», è disponibile): nero e
 *   media non bastano presi da due varianti diverse. Dentro un gruppo i valori sono «o», fra gruppi è «e».
 *  ⚠️ Chiavi e valori nell'indirizzo sono minuscoli, senza accenti, solo lettere, cifre e trattini: niente codifica, niente
 *   virgole dentro un valore. Ordine fisso (colore, lunghezza, misura, base, poi le altre in ordine alfabetico, «disp» ultima) e valori in ordine
 *   alfabetico: scrivere, leggere e riscrivere dà sempre lo stesso indirizzo, e ricaricare dà la stessa pagina.
 *  ⚠️ Un valore (o un parametro) che i gruppi non conoscono si ignora: mai un errore, mai una pagina vuota per un link vecchio.
 *  Nessun ordinamento (n. 23 della SPEC): l'ordine dei prodotti è quello in ingresso. Criterio: V1-C2. */
import { TESTI_SHOP } from "@/landing/testi-shop";
import type { ProdottoPubblico } from "./modello";

/** Quello che ai filtri serve di un prodotto: le varianti (cosa filtra) e le opzioni (i campioni del colore). */
export type Filtrabile = Pick<ProdottoPubblico, "varianti" | "opzioni">;

export interface ValoreFiltro {
  /** La chiave nell'indirizzo («250-ml»). */
  chiave: string;
  /** L'etichetta com'è nei dati («250 ml»). */
  valore: string;
  /** La foto del campione, solo per il colore e solo se c'è. Senza, il componente scrive la prima lettera su fondo notte. */
  campione: { w480: string } | null;
}

export interface GruppoFiltro {
  /** Il nome del parametro nell'indirizzo («colore»; «disp» per «Disponibile»). */
  chiave: string;
  nome: string;
  /** «Colore» a campioni, gli altri a pillole, «Disponibile» è un interruttore senza valori. */
  tipo: "campioni" | "pillole" | "interruttore";
  valori: ValoreFiltro[];
}

/** Lo stato dei filtri: i valori scelti per gruppo (chiavi, in ordine alfabetico) e «Disponibile». Un gruppo senza scelte non c'è. */
export interface StatoFiltri {
  valori: Record<string, string[]>;
  disponibile: boolean;
}

export interface ChipFiltro {
  /** La chiave del gruppo («colore», «disp»). */
  gruppo: string;
  /** La chiave del valore; `null` per «Disponibile». */
  valore: string | null;
  etichetta: string;
}

const DISP = "disp";
/** Questi gruppi vanno per primi, in quest'ordine; gli altri dopo, in ordine alfabetico. */
const NOTI = ["colore", "lunghezza", "misura", "base"];

export const FILTRI_VUOTI: StatoFiltri = Object.freeze({ valori: Object.freeze({}), disponibile: false }) as StatoFiltri;

/** «Perlé» → `perle`, «250 ml» → `250-ml`, «2,5» → `2-5`. Vuota se non resta nessuna lettera o cifra. */
const chiaveDi = (testo: unknown): string =>
  String(testo ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const posto = (chiave: string): number => {
  const i = NOTI.indexOf(chiave);
  return i < 0 ? NOTI.length : i;
};
const prima = (a: string, b: string): number => posto(a) - posto(b) || (a < b ? -1 : a > b ? 1 : 0);

// ── i gruppi ─────────────────────────────────────────────────────────────

/** I gruppi dei prodotti dati (di norma: quelli pubblicati di una categoria). Valori nell'ordine in cui compaiono. */
export function gruppiDaProdotti(prodotti: readonly Filtrabile[]): GruppoFiltro[] {
  const gruppi = new Map<string, { nome: string; valori: Map<string, ValoreFiltro> }>();
  let conDisponibili = false;
  let conEsaurite = false;
  for (const p of prodotti) {
    for (const v of p.varianti) {
      if (v.disponibile) conDisponibili = true;
      else conEsaurite = true;
      for (const [nome, valore] of Object.entries(v.opzioni)) {
        const g = chiaveDi(nome);
        const k = chiaveDi(valore);
        // shortcut: un'opzione che si chiama «Disp» (o senza lettere né cifre) non si può scrivere nell'indirizzo e non fa gruppo; si cambia se il CMS la ammette.
        if (!g || !k || g === DISP) continue;
        const gr = gruppi.get(g) ?? { nome: nome.trim(), valori: new Map() };
        if (!gr.valori.has(k)) gr.valori.set(k, { chiave: k, valore: String(valore).trim(), campione: null });
        gruppi.set(g, gr);
      }
    }
    // i campioni del colore stanno nelle opzioni del prodotto; un valore che nessuna variante usa non fa niente
    for (const o of p.opzioni) {
      const valori = gruppi.get(chiaveDi(o.nome))?.valori;
      for (const x of o.valori) {
        const dentro = valori?.get(chiaveDi(x.valore));
        if (dentro && !dentro.campione && x.campione) dentro.campione = { w480: x.campione.w480 };
      }
    }
  }
  const elenco: GruppoFiltro[] = [...gruppi.keys()].sort(prima).map((chiave) => {
    const g = gruppi.get(chiave)!;
    return { chiave, nome: g.nome, tipo: chiave === "colore" ? "campioni" : "pillole", valori: [...g.valori.values()] };
  });
  // un interruttore che non cambierebbe niente (tutto disponibile) o svuoterebbe la pagina (tutto esaurito) non è un filtro
  if (conDisponibili && conEsaurite) elenco.push({ chiave: DISP, nome: TESTI_SHOP.categoria.filtri.disponibile, tipo: "interruttore", valori: [] });
  return elenco;
}

// ── l'indirizzo ──────────────────────────────────────────────────────────

/** Tutti i testi che l'indirizzo dà per un parametro: una stringa, un URLSearchParams o l'oggetto del router (numeri e booleani compresi). */
function grezzi(sp: unknown, chiave: string): string[] {
  const x: unknown[] =
    sp instanceof URLSearchParams
      ? sp.getAll(chiave)
      : typeof sp === "string"
        ? new URLSearchParams(sp).getAll(chiave)
        : sp && typeof sp === "object" && Object.hasOwn(sp, chiave)
          ? [(sp as Record<string, unknown>)[chiave]].flat()
          : [];
  return x.filter((v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean").map(String);
}

/** Lo stato dei filtri scritto nell'indirizzo, ripulito: solo gruppi e valori che `gruppi` conosce. Non lancia mai. */
export function leggiFiltri(searchParams: unknown, gruppi: readonly GruppoFiltro[]): StatoFiltri {
  const valori: Record<string, string[]> = {};
  let disponibile = false;
  for (const g of gruppi) {
    const letti = grezzi(searchParams, g.chiave);
    if (g.tipo === "interruttore") {
      if (g.chiave === DISP && letti.some((t) => t === "1" || t === "true")) disponibile = true;
      continue;
    }
    const ammessi = new Set(g.valori.map((v) => v.chiave));
    const scelti = [...new Set(letti.flatMap((t) => t.split(",").map(chiaveDi)).filter((k) => ammessi.has(k)))].sort();
    if (scelti.length) valori[g.chiave] = scelti;
  }
  return { valori, disponibile };
}

/** Lo stato ripulito e in ordine (chiavi dei gruppi nell'ordine fisso, valori alfabetici, niente vuoti né doppioni). */
function canonico(stato: unknown): StatoFiltri {
  const s = stato && typeof stato === "object" ? (stato as Partial<StatoFiltri>) : {};
  const per = new Map<string, Set<string>>();
  for (const [nome, lista] of Object.entries(s.valori && typeof s.valori === "object" ? s.valori : {})) {
    const g = chiaveDi(nome);
    const k = Array.isArray(lista) ? lista.map(chiaveDi).filter(Boolean) : [];
    if (g && g !== DISP && k.length) per.set(g, new Set([...(per.get(g) ?? []), ...k]));
  }
  const valori: Record<string, string[]> = {};
  for (const g of [...per.keys()].sort(prima)) valori[g] = [...per.get(g)!].sort();
  return { valori, disponibile: s.disponibile === true };
}

/** L'indirizzo (senza «?») dello stato: `colore=castano,nero&misura=m&disp=1`; vuoto se non c'è nessun filtro. */
export function scriviFiltri(stato: unknown): string {
  const { valori, disponibile } = canonico(stato);
  const parti = Object.entries(valori).map(([g, k]) => `${g}=${k.join(",")}`);
  if (disponibile) parti.push(`${DISP}=1`);
  return parti.join("&");
}

// ── applicare i filtri ───────────────────────────────────────────────────

/** I prodotti con almeno una variante che soddisfa tutti i gruppi attivi (e, con «Disponibile», è disponibile). L'ordine resta. */
export function applicaFiltri<T extends Filtrabile>(prodotti: readonly T[], stato: StatoFiltri): T[] {
  const { valori, disponibile } = canonico(stato);
  const attivi = Object.entries(valori).map(([g, k]) => [g, new Set(k)] as const);
  if (!attivi.length && !disponibile) return [...prodotti];
  return prodotti.filter((p) =>
    p.varianti.some((v) => {
      if (disponibile && !v.disponibile) return false;
      const sue = new Map(Object.entries(v.opzioni).map(([n, x]) => [chiaveDi(n), chiaveDi(x)]));
      return attivi.every(([g, k]) => k.has(sue.get(g) ?? ""));
    }),
  );
}

/** Quanti prodotti passano: il «n» di «Mostra {n} prodotti». */
export const conteggio = (prodotti: readonly Filtrabile[], stato: StatoFiltri): number => applicaFiltri(prodotti, stato).length;

// ── i chip ───────────────────────────────────────────────────────────────

/** I filtri scelti, uno per valore, nell'ordine dei gruppi (e dei valori nel gruppo), «Disponibile» ultimo: i chip rimovibili del computer. */
export function chipAttivi(gruppi: readonly GruppoFiltro[], stato: StatoFiltri): ChipFiltro[] {
  const { valori, disponibile } = canonico(stato);
  return gruppi.flatMap((g): ChipFiltro[] => {
    if (g.tipo === "interruttore") return disponibile ? [{ gruppo: g.chiave, valore: null, etichetta: g.nome }] : [];
    const scelti = new Set(valori[g.chiave] ?? []);
    return g.valori.filter((v) => scelti.has(v.chiave)).map((v) => ({ gruppo: g.chiave, valore: v.chiave, etichetta: v.valore }));
  });
}

/** Quanti filtri sono attivi (uno per valore, più «Disponibile»): il «n» di «Filtra ({n})». */
export function filtriAttivi(stato: StatoFiltri): number {
  const { valori, disponibile } = canonico(stato);
  return Object.values(valori).reduce((n, k) => n + k.length, disponibile ? 1 : 0);
}

/** Lo stato senza quel chip (uno stato nuovo, in ordine; quello in ingresso non cambia). */
export function togliFiltro(stato: StatoFiltri, chip: ChipFiltro): StatoFiltri {
  const s = canonico(stato);
  if (chip.valore === null) return { ...s, disponibile: false };
  return canonico({ ...s, valori: { ...s.valori, [chip.gruppo]: (s.valori[chip.gruppo] ?? []).filter((k) => k !== chip.valore) } });
}
