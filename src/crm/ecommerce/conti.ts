/** ── I CONTI DELLA PANORAMICA E-COMMERCE ───────────────────────────────────
 *  Commessa 2026-11-17-crm-ecommerce (T4). Modulo PURO: prende gli `Ordine` di T3 e un periodo,
 *  restituisce numeri. Niente React, niente database, niente orologio (l'«adesso» si passa).
 *
 *  ── REGOLE (PIANO D7, D8) ───────────────────────────────────────────────────
 *   · «Ordini», valore medio e «Da incassare» escludono gli annullati.
 *   · «Incassato» somma OGNI ordine con `pagatoIl`, annullati compresi: un annullato pagato è
 *     denaro entrato (rimborsi qui non esistono). `annullatiPagati` lo dice, così la cifra coincide
 *     con le righe del filtro «pagato = sì».
 *   · «Ordini fermi» e «da lavorare» NON seguono il periodo: è il lavoro arretrato.
 *   · Il periodo è in giorni LOCALI, estremi inclusi (come `rangeBoundsAsDates` del filtro del CRM:
 *     00:00:00 del primo giorno dentro, 00:00:00 del giorno dopo l'ultimo fuori).
 *
 *  ── IMPORTI ASSURDI ─────────────────────────────────────────────────────────
 *  La tabella la scrive anche un anonimo (il checkout) e la policy non limita `total`, `items` né
 *  `pagato_importo`: possono arrivare importi negativi, enormi, o la cui somma straborda. Qui un
 *  importo fuori norma (negativo o sopra `IMPORTO_MAX`) vale 0 nelle somme e l'ordine si CONTA in
 *  `importiAnomali`: la pagina può dirlo, e nessuna cifra diventa `Infinity`/`NaN`. */
import { chiaveEmail, chiaveTelefono, eAnnullato, eIncassato, importoIncassato, nomeCliente, STATI_ORDINE } from "./ordine";
import type { Ordine, StatoOrdine } from "./ordine";

/** Oltre questo (100.000 €, lo stesso tetto di T8) un importo non è un ordine di un negozio di capelli: vale 0 e si segnala.
 *  shortcut: soglia unica per tutti gli importi, da rendere configurabile se mai servisse vendere cose da questa cifra in su. */
export const IMPORTO_MAX = 1e5;
/** Pezzi per riga oltre i quali la riga non conta (stessa logica degli importi). */
export const PEZZI_MAX = 1e6;
/** Giorni massimi dell'andamento: sopra, si tengono gli ultimi (730 è già il «lifetime» del filtro). */
export const GIORNI_MAX = 3660;
/** Quanti prodotti nei «più venduti». */
export const PIU_VENDUTI = 10;

const GIORNO_MS = 24 * 3600 * 1000;

// ── piccoli aiuti ──────────────────────────────────────────────────────────

const sano = (n: number, max = IMPORTO_MAX): boolean => Number.isFinite(n) && n >= 0 && n <= max;
/** Il valore se è sano, altrimenti 0. */
const oZero = (n: number, max = IMPORTO_MAX): number => (sano(n, max) ? n : 0);
const euro = (n: number): number => Math.round(n * 100) / 100;

const ISO_GIORNO = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface Periodo {
  da: string;
  a: string;
}

/** «YYYY-MM-DD» di un giorno che esiste (non 2026-02-30, che il Date sposterebbe al 2 marzo). */
const eGiorno = (g: unknown): g is string => typeof g === "string" && ISO_GIORNO.test(g) && iso(new Date(`${g}T00:00:00`)) === g;

/** Gli estremi in millisecondi (fine esclusa), o `null` se il periodo non si legge o è capovolto. */
function limiti(p: Periodo): { inizio: number; fine: number } | null {
  if (!p || !eGiorno(p.da) || !eGiorno(p.a) || p.da > p.a) return null;
  const inizio = new Date(`${p.da}T00:00:00`).getTime();
  const ultimo = new Date(`${p.a}T00:00:00`);
  ultimo.setDate(ultimo.getDate() + 1); // il giorno dopo: così il cambio d'ora non sposta niente
  const fine = ultimo.getTime();
  return Number.isFinite(inizio) && Number.isFinite(fine) ? { inizio, fine } : null;
}

const ms = (o: Pick<Ordine, "creatoIl">): number => Date.parse(o.creatoIl);
const dentro = (o: Ordine, l: { inizio: number; fine: number } | null): boolean => {
  const t = ms(o);
  return !!l && t >= l.inizio && t < l.fine;
};

/** L'ordine è stato fatto dentro il periodo (giorni locali, estremi inclusi)? */
export const nelPeriodo = (o: Ordine, p: Periodo): boolean => dentro(o, limiti(p));

/** Gli importi che contano per un ordine, già ripuliti. */
/** L'ordine ha un importo che la Panoramica NON conta (negativo o sopra `IMPORTO_MAX`)? Conta il totale se non è annullato e l'incassato se è pagato.
 *  È la stessa regola di `importiAnomali`: la lista Ordini la usa per segnalare le stesse righe. */
export const importoFuoriNorma = (o: Ordine): boolean => (!eAnnullato(o) && !sano(o.totale)) || (eIncassato(o) && !sano(importoIncassato(o)));

const totaleSano = (o: Ordine): number => oZero(o.totale);
const incassoSano = (o: Ordine): number => oZero(importoIncassato(o));

// ── Panoramica ─────────────────────────────────────────────────────────────

export interface Panoramica {
  ordini: { n: number; totale: number; medio: number };
  incassato: { n: number; importo: number };
  daIncassare: { n: number; importo: number };
  perStato: Record<StatoOrdine, number>;
  /** Annullati ma pagati: sono dentro `incassato` (D7), qui si contano per la riga «di cui N annullati». */
  annullatiPagati: number;
  /** Ordini del periodo con un importo fuori norma (negativo o enorme): valgono 0 nelle somme. */
  importiAnomali: number;
}

export function panoramica(ordini: Ordine[], p: Periodo): Panoramica {
  const l = limiti(p);
  const perStato = Object.fromEntries(STATI_ORDINE.map((s) => [s, 0])) as Record<StatoOrdine, number>;
  let nOrdini = 0, totOrdini = 0, nInc = 0, totInc = 0, nDa = 0, totDa = 0, annullatiPagati = 0, anomali = 0;
  for (const o of ordini) {
    if (!dentro(o, l)) continue;
    perStato[o.stato]++;
    const annullato = eAnnullato(o);
    const pagato = eIncassato(o);
    if (!annullato) {
      nOrdini++;
      totOrdini += totaleSano(o);
      if (!pagato) {
        nDa++;
        totDa += totaleSano(o);
      }
    }
    if (pagato) {
      nInc++;
      totInc += incassoSano(o);
      if (annullato) annullatiPagati++;
    }
    if (importoFuoriNorma(o)) anomali++;
  }
  return {
    ordini: { n: nOrdini, totale: euro(totOrdini), medio: nOrdini ? euro(totOrdini / nOrdini) : 0 },
    incassato: { n: nInc, importo: euro(totInc) },
    daIncassare: { n: nDa, importo: euro(totDa) },
    perStato,
    annullatiPagati,
    importiAnomali: anomali,
  };
}

// ── fermi e da lavorare (di sempre, non seguono il periodo) ────────────────

/** Nuovi da più di `ore` ore senza che nessuno li abbia toccati (`aggiornatoIl` vuoto). Il più vecchio per primo. */
export function ordiniFermi(ordini: Ordine[], adesso: Date, ore = 48): Ordine[] {
  const t = adesso.getTime();
  if (!Number.isFinite(t)) return [];
  const soglia = t - ore * 3600 * 1000;
  return ordini.filter((o) => o.stato === "nuovo" && o.aggiornatoIl === null && ms(o) < soglia).sort((a, b) => ms(a) - ms(b));
}

/** Quanti ordini sono ancora «nuovo»: il numeretto del menu. Di sempre. */
export const daLavorare = (ordini: Ordine[]): number => ordini.reduce((n, o) => n + (o.stato === "nuovo" ? 1 : 0), 0);

// ── andamento ──────────────────────────────────────────────────────────────

/** Un elemento per ogni giorno del periodo, anche a zero. `ordini` esclude gli annullati, `incassato` li include: come la Panoramica. */
export function andamento(ordini: Ordine[], p: Periodo): { giorno: string; ordini: number; incassato: number }[] {
  const l = limiti(p);
  if (!l) return [];
  const per = new Map<string, { ordini: number; incassato: number }>();
  for (const o of ordini) {
    if (!dentro(o, l)) continue;
    const g = iso(new Date(ms(o)));
    const v = per.get(g) ?? { ordini: 0, incassato: 0 };
    if (!eAnnullato(o)) v.ordini++;
    if (eIncassato(o)) v.incassato += incassoSano(o);
    per.set(g, v);
  }
  // I giorni, dal primo all'ultimo; oltre GIORNI_MAX si tengono gli ultimi.
  const giro = new Date(`${p.a}T00:00:00`);
  giro.setDate(giro.getDate() - (GIORNI_MAX - 1));
  const primo = iso(giro) > p.da ? iso(giro) : p.da;
  const giorni: string[] = [];
  const corrente = new Date(`${primo}T00:00:00`);
  for (let g = primo; g <= p.a; g = iso(corrente)) {
    giorni.push(g);
    corrente.setDate(corrente.getDate() + 1);
  }
  return giorni.map((giorno) => {
    const v = per.get(giorno);
    return { giorno, ordini: v?.ordini ?? 0, incassato: euro(v?.incassato ?? 0) };
  });
}

// ── prodotti più venduti ───────────────────────────────────────────────────

export interface Venduto {
  chiave: string;
  nome: string;
  slug: string | null;
  pezzi: number;
  /** Ordini distinti che lo contengono. */
  ordini: number;
  ricavo: number;
  varianti: { variante: string | null; pezzi: number; ricavo: number }[];
}

/** Per prodotto (non per variante), annullati e fuori periodo esclusi; i più venduti per pezzi, poi per ricavo. */
export function piuVenduti(ordini: Ordine[], p: Periodo, max = PIU_VENDUTI): Venduto[] {
  const l = limiti(p);
  const tetto = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : PIU_VENDUTI;
  const per = new Map<string, Venduto & { _ordini: Set<string>; _var: Map<string, { variante: string | null; pezzi: number; ricavo: number }> }>();
  for (const o of ordini) {
    if (!dentro(o, l) || eAnnullato(o)) continue;
    for (const r of o.righe) {
      const chiave = r.prodottoId ? `id:${r.prodottoId}` : `nome:${r.nome.trim().toLowerCase()}`;
      let v = per.get(chiave);
      if (!v) {
        v = { chiave, nome: r.nome, slug: r.slug, pezzi: 0, ordini: 0, ricavo: 0, varianti: [], _ordini: new Set(), _var: new Map() };
        per.set(chiave, v);
      }
      const pezzi = oZero(r.qty, PEZZI_MAX);
      const ricavo = sano(r.qty, PEZZI_MAX) ? oZero(r.qty * r.prezzo) : 0; // pezzi non sani: la riga vale 0 anche nel ricavo
      v.pezzi += pezzi;
      v.ricavo += ricavo;
      v._ordini.add(o.id);
      const k = r.variante ?? "";
      const vv = v._var.get(k) ?? { variante: r.variante, pezzi: 0, ricavo: 0 };
      vv.pezzi += pezzi;
      vv.ricavo += ricavo;
      v._var.set(k, vv);
    }
  }
  return [...per.values()]
    .map(({ _ordini, _var, ...v }) => ({
      ...v,
      ordini: _ordini.size,
      ricavo: euro(v.ricavo),
      varianti: [..._var.values()].map((x) => ({ ...x, ricavo: euro(x.ricavo) })).sort((a, b) => b.pezzi - a.pezzi),
    }))
    .sort((a, b) => b.pezzi - a.pezzi || b.ricavo - a.ricavo || a.nome.localeCompare(b.nome))
    .slice(0, tetto);
}

// ── clienti ────────────────────────────────────────────────────────────────

/** Dalla scheda scritta sull'ordine alla scheda principale viva (T5 la fornirà); `null` = non si risolve. Senza, vale la scheda com'è. */
export type Principale = (leadId: string) => string | null;

export interface Cliente {
  /** Identificativo stabile e unico fra i clienti dell'elenco. */
  chiave: string;
  /** Scheda lead principale, se gli ordini ne hanno una. */
  leadId: string | null;
  nome: string;
  telefono: string;
  email: string;
  /** Ordini non annullati. */
  n: number;
  speso: number;
  primoOrdine: string;
  ultimoOrdine: string;
  ordiniIds: string[];
}

/** Un cliente = chi condivide la scheda, o il telefono, o l'email. Due ordini su schede principali DIVERSE non si uniscono mai,
 *  nemmeno con lo stesso numero. Gli annullati non contano: chi ha solo annullati non è un cliente. */
export function raggruppaClienti(ordini: Ordine[], principale?: Principale): Cliente[] {
  const validi = ordini.filter((o) => !eAnnullato(o)).sort((a, b) => ms(a) - ms(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)); // ordine fisso: l'esito non dipende da come arrivano
  const scheda = (o: Ordine): string | null => (o.leadId ? (principale ? principale(o.leadId) : o.leadId) : null);
  const schede = validi.map(scheda);

  // Unione dei gruppi; ogni gruppo porta al massimo UNA scheda.
  const padre = validi.map((_, i) => i);
  const leadDi: (string | null)[] = [...schede];
  const radice = (i: number): number => {
    while (padre[i] !== i) i = padre[i] = padre[padre[i]];
    return i;
  };
  const unisci = (i: number, j: number) => {
    const a = radice(i), b = radice(j);
    if (a === b) return;
    if (leadDi[a] && leadDi[b] && leadDi[a] !== leadDi[b]) return; // schede diverse: restano due persone
    padre[b] = a;
    leadDi[a] = leadDi[a] ?? leadDi[b];
  };
  const visti = new Map<string, number>();
  validi.forEach((o, i) => {
    const chiavi = [schede[i] && `l:${schede[i]}`, chiaveTelefono(o.telefono) && `t:${chiaveTelefono(o.telefono)}`, chiaveEmail(o.email) && `e:${chiaveEmail(o.email)}`];
    for (const k of chiavi) {
      if (!k) continue;
      const j = visti.get(k);
      if (j === undefined) visti.set(k, i);
      else unisci(i, j);
    }
  });

  const gruppi = new Map<number, number[]>();
  validi.forEach((_, i) => {
    const r = radice(i);
    gruppi.set(r, [...(gruppi.get(r) ?? []), i]);
  });
  const clienti: Cliente[] = [];
  for (const [r, membri] of gruppi) {
    const os = membri.map((i) => validi[i]); // già dal più vecchio al più recente
    const ultimo = os[os.length - 1];
    const ultimoCon = (campo: "telefono" | "email") => [...os].reverse().find((o) => o[campo])?.[campo] ?? "";
    const lead = leadDi[r];
    const tel = os.map((o) => chiaveTelefono(o.telefono)).find(Boolean);
    const mail = os.map((o) => chiaveEmail(o.email)).find(Boolean);
    clienti.push({
      chiave: lead ? `lead:${lead}` : tel ? `tel:${tel}` : mail ? `email:${mail}` : `ordine:${os[0].id}`,
      leadId: lead,
      nome: nomeCliente(ultimo),
      telefono: ultimoCon("telefono"),
      email: ultimoCon("email"),
      n: os.length,
      speso: euro(os.reduce((s, o) => s + totaleSano(o), 0)),
      primoOrdine: os[0].creatoIl,
      ultimoOrdine: ultimo.creatoIl,
      ordiniIds: os.map((o) => o.id),
    });
  }
  return clienti.sort((a, b) => Date.parse(b.ultimoOrdine) - Date.parse(a.ultimoOrdine) || (a.chiave < b.chiave ? -1 : 1));
}

export interface Riacquisto {
  clientiNelPeriodo: number;
  tornati: number;
  /** Da 0 a 1 (0 se nessun cliente nel periodo). */
  tasso: number;
  /** I clienti tornati, i più fedeli (più ordini) per primi. */
  elenco: Cliente[];
}

/** Dei clienti che hanno ordinato nel periodo, quanti avevano già ordinato prima: un ordine precedente al periodo, oppure
 *  un secondo ordine dentro il periodo stesso. Un ordine solo annullato non vale come «già ordinato». */
export function riacquisto(ordini: Ordine[], p: Periodo, principale?: Principale): Riacquisto {
  const l = limiti(p);
  const perId = new Map(ordini.map((o) => [o.id, o]));
  const elenco: Cliente[] = [];
  let nelPeriodo = 0;
  for (const c of raggruppaClienti(ordini, principale)) {
    const os = c.ordiniIds.map((id) => perId.get(id)!); // dal più vecchio
    if (!os.some((o) => dentro(o, l))) continue;
    nelPeriodo++;
    // Tornato se almeno un suo ordine del periodo non è il suo primo di sempre.
    if (os.some((o, i) => i > 0 && dentro(o, l))) elenco.push(c);
  }
  elenco.sort((a, b) => b.n - a.n || Date.parse(b.ultimoOrdine) - Date.parse(a.ultimoOrdine));
  return { clientiNelPeriodo: nelPeriodo, tornati: elenco.length, tasso: nelPeriodo ? elenco.length / nelPeriodo : 0, elenco };
}
