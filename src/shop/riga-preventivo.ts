/** ── CHE COSA SI PUÒ SCRIVERE IN UN PREVENTIVO, DA FUORI ───────────────────
 *
 *  `/api/public/quote-create` è aperta, e deve esserlo: il preventivo lo crea
 *  la pagina del cliente, che non ha nessuna credenziale. Fin qui prendeva il
 *  corpo della richiesta e lo infilava nella tabella così com'era
 *  (`insert({ ...row })`): chiunque conoscesse l'indirizzo poteva scrivere
 *  righe nell'archivio di un'azienda, con dentro quello che voleva e nei campi
 *  che voleva.
 *
 *  Qui si decide che cosa passa. Non è una serratura — una rotta aperta non ce
 *  l'ha, per definizione — ma cambia la natura del danno possibile: da «scrivi
 *  quello che vuoi dove vuoi» a «scrivi un preventivo, fatto come un
 *  preventivo». Il resto (quante volte, da dove) lo mette la rotta.
 *
 *  ⚠️ SOLO I CAMPI PREVISTI. Un campo in più non si ignora e basta: si dice a
 *   chi chiama che è stato scartato, altrimenti il giorno in cui la pagina
 *   manderà un campo nuovo nessuno capirà perché non arriva.
 *  ⚠️ I TESTI SI ACCORCIANO, NON SI RIFIUTANO. Un nome di duemila caratteri è
 *   quasi sempre un incolla sbagliato, e rifiutare l'intero preventivo davanti
 *   a un cliente per un campo lungo sarebbe peggio del campo lungo.
 *  ⚠️ I NUMERI NON DIVENTANO MAI `NaN` NÉ NEGATIVI: un totale negativo
 *   finirebbe nei conti e nei riepiloghi come uno sconto regalato.
 *  ───────────────────────────────────────────────────────────────────────── */

/** I campi che la pagina scrive davvero, con quanto spazio gli si lascia.
 *  ⚠️ `timeline_*` NON sono qui: le tappe del lavoro le scrive il CRM da
 *   dentro, non chi apre la pagina. */
const TESTI: Record<string, number> = {
  nome: 120,
  cognome: 120,
  email: 160,
  telefono: 40,
  color_code: 40,
  problemi: 4000,
  note: 4000,
  base_choice: 200,
  discount_code: 200,
  fitting_mode: 40,
  status: 40,
  quote_ref: 24,
};
const NUMERI: Record<string, { max: number; interi?: boolean }> = {
  eta: { max: 130, interi: true },
  grey_pct: { max: 100, interi: true },
  qty: { max: 99, interi: true },
  discount_eur: { max: 1_000_000 },
  total: { max: 1_000_000 },
};
/** I due campi che portano una struttura: la soluzione scelta e le voci. */
const OGGETTI = ["base_system", "upsells"] as const;

/** Quante voci al massimo, e quanto può essere lungo un nome di voce: un
 *  elenco di diecimila righe non è un preventivo, è un modo di riempire un
 *  database. */
const MAX_VOCI = 60;
const MAX_NOME_VOCE = 300;

const testo = (v: unknown, max: number): string => String(v ?? "").trim().slice(0, max);
const numero = (v: unknown, max: number, interi?: boolean): number | null => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const dentro = Math.min(Math.max(n, 0), max);
  return interi ? Math.round(dentro) : Math.round(dentro * 100) / 100;
};

function vociPulite(v: unknown): { name: string; price: number; wasPrice?: number; dove?: string }[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, MAX_VOCI).map((x) => {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const fuori: { name: string; price: number; wasPrice?: number; dove?: string } = {
      name: testo(o.name, MAX_NOME_VOCE),
      price: numero(o.price, 1_000_000) ?? 0,
    };
    const was = numero(o.wasPrice, 1_000_000);
    if (was != null && was > 0) fuori.wasPrice = was;
    if (o.dove === "home" || o.dove === "studio") fuori.dove = o.dove;
    return fuori;
  });
}

export interface RigaPulita {
  riga: Record<string, unknown>;
  /** I campi arrivati che non sono previsti: si dicono, non si nascondono. */
  scartati: string[];
}

export function rigaPulita(grezza: unknown): RigaPulita {
  const dentro = (grezza && typeof grezza === "object" ? grezza : {}) as Record<string, unknown>;
  const riga: Record<string, unknown> = {};
  const scartati: string[] = [];
  for (const [k, v] of Object.entries(dentro)) {
    if (k in TESTI) { riga[k] = testo(v, TESTI[k]); continue; }
    if (k in NUMERI) {
      const n = numero(v, NUMERI[k].max, NUMERI[k].interi);
      //  Un numero illeggibile si lascia fuori invece di scriverci zero: la
      //  colonna accetta il vuoto, e uno zero inventato è un dato falso.
      if (n != null) riga[k] = n;
      continue;
    }
    if (k === "upsells") { riga.upsells = vociPulite(v); continue; }
    if (k === "base_system") {
      const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
      riga.base_system = {
        id: testo(o.id, 60),
        name: testo(o.name, MAX_NOME_VOCE),
        price: numero(o.price, 1_000_000) ?? 0,
      };
      continue;
    }
    scartati.push(k);
  }
  //  L'elenco delle voci c'è sempre, anche vuoto: una colonna a `null` fa
  //  inciampare tutto quello che a valle si aspetta un elenco.
  if (!(OGGETTI[1] in riga)) riga.upsells = [];
  //  Lo stato non lo decide chi chiama: un preventivo nasce nuovo.
  riga.status = "nuovo";
  return { riga, scartati };
}
