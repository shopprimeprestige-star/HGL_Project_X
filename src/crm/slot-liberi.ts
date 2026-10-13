/** ── QUANTI POSTI HO ANCORA, E A CHE ORA ────────────────────────────────────
 *
 *  Richiesta del committente (13/10/2026): «mi serve un sistema per capire
 *  quanti slot ho liberi ancora e a che orari, ottimizzato; aggiungi una
 *  scheda nel menu a sinistra».
 *
 *  Gli orari liberi li sapeva già calcolare l'agenda, ma solo DENTRO la
 *  finestra che fissa un appuntamento, un cliente alla volta. Qui si guarda la
 *  squadra intera su più giorni: quanti posti restano, a che ora, con chi.
 *
 *  ⚠️ NIENTE CONTO NUOVO. Lo stato di ogni fascia (libera, insieme, piena,
 *   coperta) lo decide `slotDelGiorno` in crm/booking-utils — la stessa regola
 *   della griglia dell'agenda e del server. Qui si sommano i suoi risultati e
 *   basta: due conti scritti in due posti dicono cose diverse sullo stesso
 *   pomeriggio, ed è già successo.
 *  ⚠️ UN POSTO NON È UNA FASCIA. Una fascia «aperta» tiene fino a tre persone
 *   (crm/capienza): con una consulenza dentro restano due posti. Si contano i
 *   POSTI, perché è il numero di clienti che si possono ancora fissare.
 *  ⚠️ «OTTIMIZZATO» VUOL DIRE RIEMPIRE PRIMA LE ORE GIÀ INIZIATE. Un'ora con
 *   una persona dentro e posto libero costa zero tempo in più al consulente;
 *   aprirne una nuova gli toglie un'ora intera. I consigliati partono da lì,
 *   e poi dal primo orario libero.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Quello che serve di uno slot calcolato da `slotDelGiorno`. */
export type SlotCalcolato = {
  ora: string;
  libero: boolean;
  presi: number;
  capienza: number;
};

export type SlotDiPersona = { id: string; nome: string; slot: SlotCalcolato[] };

export type ChiHaPosto = { id: string; nome: string; posti: number; presi: number };

export type FasciaLibera = {
  ora: string;
  /** posti ancora fissabili a quest'ora, sommati su tutta la squadra */
  posti: number;
  /** c'è già qualcuno dentro (con almeno un consulente): riempirla non costa tempo */
  iniziata: boolean;
  chi: ChiHaPosto[];
};

export type GiornoLibero = {
  data: string;
  posti: number;
  fasce: FasciaLibera[];
  /** le fasce di lavoro del giorno (di tutta la squadra, contate una volta per ora) */
  fasceTotali: number;
  /** quante di quelle ore non hanno più posto per nessuno */
  fascePiene: number;
};

const minuti = (hhmm: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
};

/** I posti che una persona ha ancora in uno slot. */
export const postiDi = (s: SlotCalcolato): number =>
  s.libero ? Math.max(0, (Number(s.capienza) || 0) - (Number(s.presi) || 0)) : 0;

/** Un giorno della squadra. `dopo` = minuti dalla mezzanotte prima dei quali
 *  non si offre niente (oggi: l'ora è già passata). */
export function riassumiGiorno(p: { data: string; persone: SlotDiPersona[]; dopo?: number }): GiornoLibero {
  const perOra = new Map<string, { chi: ChiHaPosto[]; lavora: boolean }>();
  for (const persona of p.persone) {
    for (const s of persona.slot ?? []) {
      const m = minuti(s.ora);
      if (m < 0 || (p.dopo != null && m < p.dopo)) continue;
      const voce = perOra.get(s.ora) ?? { chi: [], lavora: false };
      voce.lavora = true;
      const posti = postiDi(s);
      if (posti > 0) voce.chi.push({ id: persona.id, nome: persona.nome, posti, presi: Number(s.presi) || 0 });
      perOra.set(s.ora, voce);
    }
  }
  const ore = [...perOra.keys()].sort((a, b) => minuti(a) - minuti(b));
  const fasce: FasciaLibera[] = [];
  let piene = 0;
  for (const ora of ore) {
    const v = perOra.get(ora)!;
    if (v.chi.length === 0) {
      piene += 1;
      continue;
    }
    //  Prima chi ha già gente a quell'ora: è lì che conviene mettere il cliente.
    const chi = [...v.chi].sort((a, b) => b.presi - a.presi || a.nome.localeCompare(b.nome));
    fasce.push({
      ora,
      posti: chi.reduce((t, c) => t + c.posti, 0),
      iniziata: chi.some((c) => c.presi > 0),
      chi,
    });
  }
  return {
    data: p.data,
    posti: fasce.reduce((t, f) => t + f.posti, 0),
    fasce,
    fasceTotali: ore.length,
    fascePiene: piene,
  };
}

export type Consigliato = { data: string; ora: string; chi: ChiHaPosto; iniziata: boolean };

/** Gli orari da proporre per primi: prima le ore già iniziate (stessa
 *  persona, stessa ora, zero tempo in più), poi le prime libere. Dentro ogni
 *  gruppo, la data più vicina: un appuntamento presto si perde di meno. */
export function daRiempirePrima(giorni: GiornoLibero[], quanti = 6): Consigliato[] {
  const tutti: Consigliato[] = [];
  for (const g of giorni)
    for (const f of g.fasce) tutti.push({ data: g.data, ora: f.ora, chi: f.chi[0], iniziata: f.iniziata });
  const quando = (c: Consigliato) => `${c.data} ${String(minuti(c.ora)).padStart(4, "0")}`;
  const iniziate = tutti.filter((c) => c.iniziata).sort((a, b) => quando(a).localeCompare(quando(b)));
  const nuove = tutti.filter((c) => !c.iniziata).sort((a, b) => quando(a).localeCompare(quando(b)));
  return [...iniziate, ...nuove].slice(0, Math.max(0, quanti));
}

/** «lun 14 ott» */
export function etichettaGiorno(data: string): string {
  const d = new Date(`${data}T00:00:00`);
  if (Number.isNaN(d.getTime())) return data;
  return d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
}

/** Il testo da incollare in un messaggio al cliente: i giorni con posto e le
 *  loro ore, senza nomi né numeri interni. */
export function testoDaCopiare(giorni: GiornoLibero[], maxGiorni = 5): string {
  return giorni
    .filter((g) => g.fasce.length > 0)
    .slice(0, Math.max(1, maxGiorni))
    .map((g) => {
      const e = etichettaGiorno(g.data);
      return `${e.charAt(0).toUpperCase()}${e.slice(1)}: ${g.fasce.map((f) => f.ora).join(", ")}`;
    })
    .join("\n");
}

/** I totali della pagina. */
export function totali(giorni: GiornoLibero[]): {
  posti: number;
  fasce: number;
  giorniConPosto: number;
  giorniPieni: number;
} {
  let posti = 0;
  let fasce = 0;
  let giorniConPosto = 0;
  let giorniPieni = 0;
  for (const g of giorni) {
    posti += g.posti;
    fasce += g.fasce.length;
    if (g.fasce.length > 0) giorniConPosto += 1;
    else if (g.fasceTotali > 0) giorniPieni += 1;
  }
  return { posti, fasce, giorniConPosto, giorniPieni };
}
