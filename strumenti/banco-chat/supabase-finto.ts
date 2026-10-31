/** Un database finto in memoria che parla come PostgREST (solo quello che usa la chat) e conta
 *  richieste, righe e byte. Dati SINTETICI (`dati-finti.ts`): niente clienti. Solo per il banco di misura. */
import { genera, ADESSO } from "./dati-finti";
import { scenaRiga } from "./scena-riga";

type Riga = Record<string, unknown>;
export const stats = { richieste: 0, righe: 0, byte: 0, log: [] as { t: string; q: string; righe: number; byte: number }[] };
export const LATENZA_MS = Number((globalThis as { __LATENZA?: number }).__LATENZA ?? 60);

const P = new URLSearchParams(location.search);
export const D = P.get("scena") === "riga" ? scenaRiga() : genera({
  contatti: Number(P.get("contatti") ?? 2174),
  leads: Number(P.get("leads") ?? 2000),
  messaggi: Number(P.get("messaggi") ?? 45000),
});
// Ogni messaggio ha anche un «raw_payload» pesante, come nel database vero (non va mai letto).
const tabelle: Record<string, Riga[]> = {
  whatsapp_messages: D.messaggi.map((m) => ({ ...m, raw_payload: { x: "y".repeat(300) } })) as unknown as Riga[],
  whatsapp_contacts: D.contatti as unknown as Riga[],
  crm_leads: D.leads as unknown as Riga[],
};

const cmp = (a: unknown, b: unknown) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);

class Q implements PromiseLike<{ data: unknown; error: null }> {
  private f: ((r: Riga) => boolean)[] = [];
  private ord: { c: string; asc: boolean } | null = null;
  private lim = Infinity;
  private da = 0;
  private cols = "*";
  private modo: "select" | "update" | "delete" = "select";
  private patch: Riga | null = null;
  private una = false;
  constructor(private t: string) {}
  select(c = "*") { this.cols = c; return this; }
  eq(k: string, v: unknown) { this.f.push((r) => r[k] === v); return this; }
  is(k: string, v: unknown) { this.f.push((r) => (r[k] ?? null) === v); return this; }
  not(k: string, _op: string, v: unknown) { this.f.push((r) => (r[k] ?? null) !== v); return this; }
  gte(k: string, v: string) { this.f.push((r) => String(r[k] ?? "") >= v); return this; }
  gt(k: string, v: string) { this.f.push((r) => String(r[k] ?? "") > v); return this; }
  in(k: string, v: unknown[]) { this.f.push((r) => v.includes(r[k])); return this; }
  or(s: string) {
    const conds = s.split(",").map((x) => x.split(".")).map(([k, , ...v]) => [k, v.join(".")] as const);
    this.f.push((r) => conds.some(([k, v]) => r[k] === v));
    return this;
  }
  order(c: string, o?: { ascending?: boolean }) { this.ord = { c, asc: o?.ascending !== false }; return this; }
  limit(n: number) { this.lim = n; return this; }
  range(a: number, b: number) { this.da = a; this.lim = b - a + 1; return this; }
  maybeSingle() { this.una = true; this.lim = 1; return this; }
  update(p: Riga) { this.modo = "update"; this.patch = p; return this; }
  delete() { this.modo = "delete"; return this; }
  upsert() { return this; }
  then<A, B>(ok?: ((v: { data: unknown; error: null }) => A | PromiseLike<A>) | null, no?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return new Promise<{ data: unknown; error: null }>((res) => setTimeout(() => res(this.esegui()), LATENZA_MS)).then(ok, no);
  }
  private esegui() {
    const src = tabelle[this.t] ?? [];
    let rows = src.filter((r) => this.f.every((f) => f(r)));
    if (this.modo === "update" && this.patch) { for (const r of rows) Object.assign(r, this.patch); }
    if (this.ord) { const { c, asc } = this.ord; rows = [...rows].sort((a, b) => (asc ? 1 : -1) * cmp(a[c], b[c])); }
    rows = rows.slice(this.da, this.da + this.lim);
    const cols = this.cols === "*" ? null : this.cols.split(",").map((c) => c.trim());
    const out = cols ? rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]]))) : rows;
    const byte = JSON.stringify(out).length;
    stats.richieste++; stats.righe += out.length; stats.byte += byte;
    stats.log.push({ t: this.t, q: `${this.modo} ${this.cols.slice(0, 40)} filtri=${this.f.length} ${this.ord ? "ord=" + this.ord.c : ""} lim=${this.lim === Infinity ? "-" : this.lim}`, righe: out.length, byte });
    return { data: this.una ? (out[0] ?? null) : out, error: null as null };
  }
}

type Cb = (e: unknown) => void;
const canali: { tab: string; cb: Cb }[] = [];
export const eventi = {
  /** Fa arrivare un evento come farebbe il tempo reale. */
  emetti(tab: string, e: unknown) { for (const c of canali) if (c.tab === tab) c.cb(e); },
  quanti: () => canali.length,
};

const canale = () => {
  const mio: { tab: string; cb: Cb }[] = [];
  const c = {
    on(_t: string, cfg: { table: string }, cb: Cb) { const v = { tab: cfg.table, cb }; mio.push(v); canali.push(v); return c; },
    subscribe(cb?: (s: string) => void) { setTimeout(() => cb?.("SUBSCRIBED"), 5); return c; },
    _mio: mio,
  };
  return c;
};

export const supabase = {
  from: (t: string) => new Q(t),
  rpc: async () => ({ data: true, error: null }),
  channel: () => canale(),
  removeChannel: async (c: { _mio?: { tab: string; cb: Cb }[] }) => { for (const v of c?._mio ?? []) { const i = canali.indexOf(v); if (i >= 0) canali.splice(i, 1); } },
  realtime: { setAuth: async () => {} },
  auth: {
    getSession: async () => ({ data: { session: { access_token: "finto" } }, error: null }),
    refreshSession: async () => ({ data: { session: { access_token: "finto" } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
};
export { ADESSO };

/** Un messaggio vivo del cliente (come lo scrivono il server e i trigger): riga nuova, contatto aggiornato, due eventi. */
export function arrivaMessaggio(i: number) {
  const c = D.contatti[(i * 37) % 400]; // chat «calde»
  const ora = new Date().toISOString();
  const m = {
    id: `vivo-${i}-${Date.now()}`, user_id: D.utente, lead_id: null, direction: "inbound", from_number: c.phone_e164, to_number: "123456789",
    body: "Messaggio vivo " + i, status: "delivered", wa_message_id: "mc-in:" + i, error_message: null, created_at: ora, delivered_at: null, read_at: null,
    canale: "manychat", duplicato_di: null, cambiato_il: ora, raw_payload: { x: "y".repeat(300) },
  };
  tabelle.whatsapp_messages.push(m as unknown as Riga);
  const vecchio = { ...c };
  Object.assign(c, { ultimo_in_entrata_il: ora, ultimo_in_entrata_anteprima: m.body, ultimo_messaggio_il: ora, ultimo_messaggio_anteprima: m.body, ultimo_messaggio_direzione: "inbound", last_message_at: ora, unread_count: 1, updated_at: ora });
  eventi.emetti("whatsapp_messages", { eventType: "INSERT", new: m, old: {} });
  eventi.emetti("whatsapp_contacts", { eventType: "UPDATE", new: { ...c }, old: vecchio });
}
