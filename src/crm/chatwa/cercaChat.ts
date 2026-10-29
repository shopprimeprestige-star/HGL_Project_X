import { statoChiamata } from "./daChiamare";

/** La ricerca dell'elenco, per conto di `ElencoChat`: nome della scheda, numero e, in più di
 *  `visibili` (useChatWa), il nome salvato dal contatto, così un «numero senza scheda» col
 *  nome di ManyChat si trova per nome. Pura: niente React, niente Supabase. La usano `visibili`
 *  e tutti i riquadri di `ElencoChat`; le pastiglie sono `passaFiltro`. */
export interface ChatCercabile {
  phone: string;
  lead?: { data: { nome?: string | null; cognome?: string | null } } | null;
  contact?: { display_name?: string | null } | null;
}

/** La chat combacia con la ricerca? Ricerca vuota = sì. Maiuscole e spazi ai bordi non contano. */
export function combaciaRicerca(c: ChatCercabile, ricerca: string): boolean {
  const q = ricerca.trim().toLowerCase();
  if (!q) return true;
  const nomeScheda = `${c.lead?.data.nome ?? ""} ${c.lead?.data.cognome ?? ""}`.toLowerCase();
  //  Il numero si trova anche scritto come lo si legge («+39 333 000 1234»): si confrontano le cifre.
  const cifreQ = q.replace(/\D/g, "");
  const perNumero = cifreQ.length >= 3 && c.phone.replace(/\D/g, "").includes(cifreQ);
  return (
    nomeScheda.includes(q) ||
    c.phone.toLowerCase().includes(q) ||
    perNumero ||
    (c.contact?.display_name ?? "").toLowerCase().includes(q)
  );
}

/** La pastiglia scelta (Tutte / Non letti / Con lead / Sconosciuti) lascia passare la chat?
 *  Vale per OGNI riquadro dell'elenco: «Da rispondere», «Da chiamare» e le «vecchie» la
 *  ignoravano e, siccome quasi tutte le chat stanno lì sopra, cliccare non cambiava niente. */
export function passaFiltro(
  c: {
    lead?: { data?: { stato?: string | null } | null } | null;
    unread?: number;
    finestra?: { aperta: boolean } | null;
  },
  filtro: "all" | "unread" | "with-lead" | "unknown" | "da-chiamare" | "chiuso-24h" | "aperto-24h",
): boolean {
  if (filtro === "unread") return (c.unread ?? 0) > 0;
  if (filtro === "with-lead") return Boolean(c.lead);
  if (filtro === "unknown") return !c.lead;
  //  «Da chiamare»: lead in uno dei cinque stati di chiamata (vedi daChiamare.ts).
  if (filtro === "da-chiamare") return statoChiamata(c) !== null;
  //  ── APPUNTAMENTO FISSATO E FINESTRA DI 24 ORE (29/10/2026) ──────────
  //  Richiesta del titolare: i lead con l'appuntamento fissato che non
  //  scrivono da più di 24 ore vanno in «Chiuso 24h» (si scrive solo con un
  //  modello, o dal telefono); appena il cliente riscrive passano in «24h
  //  aperto». Una chat senza finestra calcolata non sta in nessuna delle due.
  if (filtro === "chiuso-24h" || filtro === "aperto-24h") {
    const stato = c.lead?.data?.stato;
    if (stato !== "appuntamento_fissato" && stato !== "appuntamento_rifissato") return false;
    if (!c.finestra) return false;
    return filtro === "aperto-24h" ? c.finestra.aperta : !c.finestra.aperta;
  }
  return true;
}

/** Le chat con più stelle salgono in cima (3, poi 2, poi 1); a parità di stelle resta l'ordine
 *  di prima (`sort` è stabile). Non muta l'ingresso. Vale per ogni riquadro dell'elenco: dentro
 *  «Da rispondere» chi aspetta da più tempo resta sopra fra le chat con le stesse stelle. */
export function ordinaPerStelle<T extends { phone: string }>(
  righe: T[],
  stelleDi: (phone: string) => number,
): T[] {
  return [...righe].sort((a, b) => stelleDi(b.phone) - stelleDi(a.phone));
}
