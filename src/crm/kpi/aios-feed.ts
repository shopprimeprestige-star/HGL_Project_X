// ── IL FEED DEI NUMERI PER AIOS ─────────────────────────────────────────────
//
//  Tutto il calcolo di GET /api/aios/kpi sta qui, in un file PURO: riceve righe
//  già lette dal database e restituisce il JSON del contratto (versione 1). La
//  rotta (routes/api.aios.kpi) si limita a leggere le tabelle e a chiamare
//  `costruisciFeedKpi`: così il calcolo si prova senza rete, con lead finti
//  (prove/prove.mjs, proveDelFeedAios).
//
//  ── UNA SOLA DEFINIZIONE ──────────────────────────────────────────────────
//  Vendita = `eConversione`, incasso = `ricavoLordo`, canale = `canaleDi`,
//  consulenza fatta = `STATI_CONSULENZA`: le stesse funzioni delle pagine KPI
//  del CRM. NON si usano `leadIsConverted` / `leadRevenue` / `leadPlatform` di
//  ads-financials, che hanno definizioni diverse: AIOS leggerebbe numeri che
//  nel CRM non esistono.
//
//  ── LA SPESA, SENZA REACT ─────────────────────────────────────────────────
//  La regola di `costruisciRegistroSpesa` (crm/kpi/spesa) è questa: se un
//  giorno ha una registrazione scritta a mano, VINCE LEI sul giorno intero;
//  altrimenti vale la spesa sincronizzata; in più la stima TikTok sui giorni
//  scoperti. Quel file importa `@/crm/ui` (React) e qui non può entrare, quindi
//  la regola è ricostruita in `spesaPerGiorno` con lo stesso ordine di
//  precedenza. Se cambia là, cambia anche qui (e la prova lo dice).
//
//  ── PRIVACY: LA APPLICA IL SERVER, NON CHI LEGGE ──────────────────────────
//  · ogni conteggio fra 1 e 4 diventa la stringa "<5"; 0 resta 0;
//  · `incasso` e `roas` solo con almeno 5 clienti, altrimenti null; l'incasso è
//    arrotondato alle centinaia;
//  · nessun nome, telefono, email, nota, id di lead, publicLeadId, data di un
//    singolo lead: escono solo conteggi, mediane e somme;
//  · i motivi di perdita sono una categoria chiusa, mai la nota libera;
//  · niente dati per consulente.
//  ⚠️ I rapporti (cpl, cac…) si calcolano sui numeri veri e non sui mascherati:
//   un costo per lead su tre lead non rivela nessuna persona, ma resta un
//   numero che chi legge non può rifare a mano. È il contratto.

import type { AdSpending, Lead } from "@/crm/types";
import { eAppuntamento, fasePer } from "@/crm/types";
import { eConversione, giornoDi, ricavoLordo, STATI_CONSULENZA } from "@/crm/kpi-calcoli";
import { canaleDi } from "@/crm/kpi/canale";

export const SOGLIA_MIN = 5;
export const FUSO = "Europe/Rome";
const MS_ORA = 3_600_000;
const MS_GIORNO = 86_400_000;

/** Un conteggio come lo vede chi legge: il numero, oppure "<5" se è 1-4. */
export type Conteggio = number | "<5";
export interface Frazione {
  n: Conteggio;
  d: Conteggio;
}

/** La maschera della privacy. 0 resta 0, da 1 a 4 diventa "<5". */
export function maschera(n: number): Conteggio {
  return n > 0 && n < SOGLIA_MIN ? "<5" : n;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const tondo = (n: number, cifre = 2): number => {
  const f = 10 ** cifre;
  return Math.round(n * f) / f;
};
/** Rapporto, o null se non si può dire (denominatore zero o numeratore nullo). */
const rapporto = (a: number, b: number): number | null => (b > 0 && a > 0 ? tondo(a / b) : null);

// ── LE RIGHE CHE ARRIVANO DAL DATABASE ──────────────────────────────────────
export interface RigaSpesaMeta {
  spend_date: string;
  ad_id: string;
  ad_name?: string | null;
  campaign_name?: string | null;
  spend?: number | null;
  impressions?: number | null;
  video_3_sec_watched?: number | null;
  video_thruplays?: number | null;
  fetched_at?: string | null;
}
export interface RigaSpesaTiktok {
  spend_date: string;
  ad_id: string;
  ad_name?: string | null;
  campaign_name?: string | null;
  spend?: number | null;
  impressions?: number | null;
  video_watched_2s?: number | null;
  video_views_p75?: number | null;
  fetched_at?: string | null;
}
/** Dalla riga pubblica serve solo l'annuncio: nome, telefono e il resto non
 *  entrano mai in questo modulo. */
export interface AnnuncioPubblico {
  ad_id?: string | null;
  ad_name?: string | null;
  creative_name?: string | null;
}

export interface IngressoFeed {
  /** Adesso. Le attese («da oltre 2 ore») si misurano su questo istante. */
  adesso: Date;
  /** Il giorno di oggi in Europe/Rome, «AAAA-MM-GG». Se manca, si ricava da `adesso`. */
  oggi?: string;
  leads: Lead[];
  /** Annuncio delle righe pubbliche, per id della riga (= `publicLeadId` del lead). */
  pubblici: Record<string, AnnuncioPubblico>;
  spesaMeta: RigaSpesaMeta[];
  spesaTiktok: RigaSpesaTiktok[];
  /** Registrazioni scritte a mano (tabella crm_ad_spending). */
  aMano: AdSpending[];
  /** Budget giornaliero TikTok dalle impostazioni (stima sui giorni senza righe). */
  tiktokAlGiorno: number;
}

// ── I GIORNI, NEL FUSO DI ROMA ──────────────────────────────────────────────
//  Il Worker gira in UTC: `getDate()` darebbe il giorno di Greenwich, e un
//  lead arrivato all'una di notte italiana finirebbe nella settimana
//  sbagliata ogni domenica sera. Si legge sempre con il fuso dichiarato.
const FMT_ROMA = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Il giorno di Roma di un istante ISO, «AAAA-MM-GG». Vuoto se illeggibile.
 *  Un valore che è GIÀ un giorno resta com'è (mezzanotte UTC sarebbe ieri). */
export function giornoRoma(valore: unknown): string {
  const t = String(valore ?? "").trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  return FMT_ROMA.format(d);
}

const aMezzogiorno = (g: string) => new Date(`${g}T12:00:00Z`);
/** Somma giorni a un «AAAA-MM-GG». Si passa da mezzogiorno UTC: niente salti d'ora legale. */
export function sommaGiorni(g: string, giorni: number): string {
  const d = aMezzogiorno(g);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}
/** Giorni di distanza fra due «AAAA-MM-GG» (b - a). */
export function giorniTra(a: string, b: string): number {
  return Math.round((aMezzogiorno(b).getTime() - aMezzogiorno(a).getTime()) / MS_GIORNO);
}
/** Elenco dei giorni da `da` ad `a`, estremi compresi. */
export function elencoGiorni(da: string, a: string): string[] {
  const out: string[] = [];
  for (let g = da; g <= a && out.length < 400; g = sommaGiorni(g, 1)) out.push(g);
  return out;
}
/** Il lunedì della settimana di quel giorno (settimana lunedì-domenica). */
export function lunedi(g: string): string {
  const dow = aMezzogiorno(g).getUTCDay(); // 0 = domenica
  return sommaGiorni(g, -((dow + 6) % 7));
}
const ultimoDelMese = (g: string): string => {
  const d = aMezzogiorno(g);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
};
const primoDelMese = (g: string) => `${g.slice(0, 8)}01`;

export interface Finestra {
  da: string;
  a: string;
}
export interface FinestreFeed {
  settimana: Finestra;
  settimana_prima: Finestra;
  mese: Finestra & { giorni_passati: number; giorni_totali: number };
  mese_prima: Finestra;
  trenta: Finestra;
  /** Le ultime 8 settimane CHIUSE, dalla più vecchia. */
  settimane: Finestra[];
}

/** Tutte le finestre del contratto, partendo da «oggi» (Europe/Rome).
 *  La settimana è l'ultima CHIUSA: se oggi è lunedì è quella appena finita. */
export function finestre(oggi: string): FinestreFeed {
  const lunediCorrente = lunedi(oggi);
  const settimane: Finestra[] = [];
  for (let i = 8; i >= 1; i--) {
    const da = sommaGiorni(lunediCorrente, -7 * i);
    settimane.push({ da, a: sommaGiorni(da, 6) });
  }
  const primoMese = primoDelMese(oggi);
  const ultimoMesePrima = sommaGiorni(primoMese, -1);
  return {
    settimana: settimane[7],
    settimana_prima: settimane[6],
    mese: {
      da: primoMese,
      a: oggi,
      giorni_passati: giorniTra(primoMese, oggi) + 1,
      giorni_totali: Number(ultimoDelMese(oggi).slice(8, 10)),
    },
    mese_prima: { da: primoDelMese(ultimoMesePrima), a: ultimoMesePrima },
    trenta: { da: sommaGiorni(oggi, -29), a: oggi },
    settimane,
  };
}

/** Il giorno più lontano che serve alla spesa: lo usa la rotta per non leggere
 *  tutta la tabella. */
export function primoGiornoNecessario(oggi: string): string {
  const f = finestre(oggi);
  return [f.settimane[0].da, f.mese_prima.da, f.trenta.da, f.mese.da].sort()[0];
}

// ── LA SPESA, GIORNO PER GIORNO ─────────────────────────────────────────────
interface SpesaGiorno {
  meta: number;
  tiktok: number;
  /** Stima dal budget giornaliero: solo dove TikTok non ha righe. */
  stimata: number;
  /** Scritta a mano e senza un canale riconoscibile: conta nel totale e basta. */
  altro: number;
}

/** A quale canale appartiene una registrazione a mano (stessa regola di
 *  `canaleDellaRegistrazione` in crm/kpi/spesa): solo quello che il campo dice. */
function canaleRegistrazione(fonte: unknown): "meta" | "tiktok" | null {
  const f = String(fonte || "").trim().toLowerCase();
  if (f === "meta" || f === "facebook" || f === "instagram") return "meta";
  if (f === "tiktok") return "tiktok";
  return null;
}

/** La regola della spesa di `costruisciRegistroSpesa`, per giorno:
 *   1. se il giorno ha registrazioni a mano, VINCONO e basta (né sincronizzata
 *      né stima: sommarle conterebbe due volte la stessa giornata);
 *   2. altrimenti Meta e TikTok sincronizzate;
 *   3. se TikTok non ha NESSUNA riga quel giorno e c'è un budget, la stima. */
export function spesaPerGiorno(
  giorni: string[],
  ingresso: Pick<IngressoFeed, "spesaMeta" | "spesaTiktok" | "aMano" | "tiktokAlGiorno">,
): Map<string, SpesaGiorno> {
  const mano = new Map<string, AdSpending[]>();
  for (const s of ingresso.aMano ?? []) {
    if (!s?.data || typeof s.data !== "object") continue;
    const g = giornoDi(s.data.data);
    if (!g) continue;
    const righe = mano.get(g) ?? [];
    righe.push(s);
    mano.set(g, righe);
  }
  const somma = (righe: { spend_date: string; spend?: number | null }[]) => {
    const m = new Map<string, number>();
    for (const r of righe ?? []) {
      const g = giornoDi(r?.spend_date);
      if (g) m.set(g, (m.get(g) ?? 0) + num(r.spend));
    }
    return m;
  };
  const meta = somma(ingresso.spesaMeta);
  const tiktok = somma(ingresso.spesaTiktok);

  const out = new Map<string, SpesaGiorno>();
  for (const g of giorni) {
    const r: SpesaGiorno = { meta: 0, tiktok: 0, stimata: 0, altro: 0 };
    const scritte = mano.get(g);
    if (scritte) {
      for (const s of scritte) {
        const importo = num(s.data.importoSpeso);
        const canale = canaleRegistrazione(s.data.fonte);
        if (canale === "meta") r.meta += importo;
        else if (canale === "tiktok") r.tiktok += importo;
        else r.altro += importo;
      }
    } else {
      r.meta = meta.get(g) ?? 0;
      r.tiktok = tiktok.get(g) ?? 0;
      if (!tiktok.has(g) && ingresso.tiktokAlGiorno > 0) r.stimata = ingresso.tiktokAlGiorno;
    }
    out.set(g, r);
  }
  return out;
}

function sommaSpesa(per: Map<string, SpesaGiorno>, w: Finestra) {
  const t = { meta: 0, tiktok: 0, stimata: 0, altro: 0, giorniStimati: 0 };
  for (const g of elencoGiorni(w.da, w.a)) {
    const r = per.get(g);
    if (!r) continue;
    t.meta += r.meta;
    t.tiktok += r.tiktok;
    t.stimata += r.stimata;
    t.altro += r.altro;
    if (r.stimata > 0) t.giorniStimati++;
  }
  return t;
}

// ── IL LEAD, LETTO PER CHI NON HA IL CRM DAVANTI ────────────────────────────
type CanaleFeed = "meta" | "tiktok" | "organico" | "passaparola" | "store";

/** Il canale con le cinque voci del contratto: `canaleDi` decide fra pagato e
 *  organico (stessa funzione delle pagine KPI), il campo «fonte» scioglie
 *  l'organico in passaparola e store. */
function canaleFeed(l: Lead): CanaleFeed {
  const c = canaleDi(l);
  if (c === "meta") return "meta";
  if (c === "tiktok") return "tiktok";
  const fonte = String(l.data?.fonte ?? "").trim().toLowerCase();
  if (fonte === "passa parola") return "passaparola";
  if (fonte === "store") return "store";
  return "organico";
}

interface LeadLetto {
  l: Lead;
  giorno: string;
  canale: CanaleFeed;
  /** Escluso da «lead» come in calcolaMetricheGenerali: no-show e rinviati. */
  conteggiabile: boolean;
  appuntamento: boolean;
  fatta: boolean;
  noShow: boolean;
  cliente: boolean;
  persa: boolean;
  aperta: boolean;
  incasso: number;
  adId: string;
}

const STATI_NO_SHOW = ["no_show", "non_fatto"];
const STATI_NON_CONTEGGIABILI = ["no_show", "fissa_meet_dopo"];

function leggi(l: Lead, pubblici: Record<string, AnnuncioPubblico>): LeadLetto {
  const d = l.data;
  const stato = String(d.stato ?? "");
  const cliente = eConversione(l);
  const fase = fasePer(d.stato);
  const idPubblico = d.publicLeadId;
  // L'annuncio: prima quello copiato sul lead, poi quello della riga pubblica.
  const adId = String(d.tracking?.ad_id || (idPubblico ? pubblici[idPubblico]?.ad_id : "") || "").trim();
  return {
    l,
    giorno: giornoRoma(d.createdAt),
    canale: canaleFeed(l),
    conteggiabile: !STATI_NON_CONTEGGIABILI.includes(stato),
    // Come `appuntamenti` di calcolaMetricheGenerali: ha una data meeting e
    // non è un no-show né un rinvio.
    appuntamento: !!d.dataMeeting && !STATI_NON_CONTEGGIABILI.includes(stato),
    fatta: STATI_CONSULENZA.includes(stato),
    noShow: STATI_NO_SHOW.includes(stato),
    cliente,
    persa: fase === "persa",
    aperta: !cliente && fase !== "vinta" && fase !== "persa" && fase !== "chiusa",
    incasso: cliente ? ricavoLordo(l) : 0,
    adId,
  };
}

// ── I KPI DI UN INSIEME DI LEAD ─────────────────────────────────────────────
export interface KpiFeed {
  lead: Conteggio;
  lead_per_canale: Record<CanaleFeed, Conteggio>;
  contattati: Conteggio;
  fissate: Conteggio;
  fatte: Conteggio;
  no_show: Conteggio;
  aperti: Conteggio;
  clienti: Conteggio;
  persi: Conteggio;
  incasso: number | null;
  spesa: { meta: number; tiktok: number; tiktok_stimata: number; totale: number };
  cpl: number | null;
  costo_per_fatta: number | null;
  cac: number | null;
  roas: number | null;
  show_rate: Frazione;
  close_rate: Frazione;
  lead_fissate: Frazione;
}

const frazione = (n: number, d: number): Frazione => ({ n: maschera(n), d: maschera(d) });

function kpi(righe: LeadLetto[], spesa: ReturnType<typeof sommaSpesa>): KpiFeed {
  const conteggiabili = righe.filter((r) => r.conteggiabile);
  const lead = conteggiabili.length;
  const perCanale: Record<CanaleFeed, number> = { meta: 0, tiktok: 0, organico: 0, passaparola: 0, store: 0 };
  for (const r of conteggiabili) perCanale[r.canale]++;

  const contattati = conteggiabili.filter((r) => String(r.l.data.stato) !== "da_contattare").length;
  const fissate = righe.filter((r) => r.appuntamento).length;
  const fatte = righe.filter((r) => r.fatta).length;
  const noShow = righe.filter((r) => r.noShow).length;
  const clienti = righe.filter((r) => r.cliente).length;
  const persi = righe.filter((r) => r.persa).length;
  const aperti = righe.filter((r) => r.aperta).length;

  // Show rate: fra chi aveva un appuntamento (rinvii esclusi) quanti NON sono
  // no-show. Il denominatore ha dentro i no-show, altrimenti sarebbe sempre 100%.
  const conMeeting = righe.filter((r) => !!r.l.data.dataMeeting && String(r.l.data.stato) !== "fissa_meet_dopo");
  const mancati = conMeeting.filter((r) => r.noShow).length;

  const totale = spesa.meta + spesa.tiktok + spesa.stimata + spesa.altro;
  const incasso = righe.reduce((s, r) => s + r.incasso, 0);
  // Sotto soglia l'incasso e il ROAS non escono: con 1-4 clienti sarebbero la
  // vendita di una persona sola.
  const abbastanza = clienti >= SOGLIA_MIN;

  return {
    lead: maschera(lead),
    lead_per_canale: {
      meta: maschera(perCanale.meta),
      tiktok: maschera(perCanale.tiktok),
      organico: maschera(perCanale.organico),
      passaparola: maschera(perCanale.passaparola),
      store: maschera(perCanale.store),
    },
    contattati: maschera(contattati),
    fissate: maschera(fissate),
    fatte: maschera(fatte),
    no_show: maschera(noShow),
    aperti: maschera(aperti),
    clienti: maschera(clienti),
    persi: maschera(persi),
    incasso: abbastanza ? Math.round(incasso / 100) * 100 : null,
    spesa: {
      meta: tondo(spesa.meta),
      tiktok: tondo(spesa.tiktok),
      tiktok_stimata: tondo(spesa.stimata),
      totale: tondo(totale),
    },
    cpl: rapporto(totale, lead),
    costo_per_fatta: rapporto(totale, fatte),
    cac: rapporto(totale, clienti),
    roas: abbastanza ? rapporto(incasso, totale) : null,
    show_rate: frazione(conMeeting.length - mancati, conMeeting.length),
    close_rate: frazione(clienti, fatte),
    lead_fissate: frazione(fissate, lead),
  };
}

// ── LE ALTRE SEZIONI ────────────────────────────────────────────────────────
const mediana = (v: number[]): number | null => {
  if (!v.length) return null;
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

/** Il primo `AAAA-MM-GG-parole` dentro il nome dell'annuncio, in minuscolo. */
export function slugDalNome(nome: string | null | undefined): string | null {
  const m = String(nome ?? "").match(/\d{4}-\d{2}-\d{2}-[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*/);
  return m ? m[0].toLowerCase() : null;
}

interface AccAnnuncio {
  ad_id: string;
  nome: string;
  campagna: string;
  piattaforma: "meta" | "tiktok";
  spesa: number;
  impressioni: number;
  /** Numeratore e denominatore dell'hook e della tenuta, sommati sulle righe. */
  v1: number;
  v2: number;
}

function perAnnuncio(
  righe: LeadLetto[],
  finestra: Finestra,
  ingresso: IngressoFeed,
  pubblici: Record<string, AnnuncioPubblico>,
) {
  const acc = new Map<string, AccAnnuncio>();
  const dentro = (g: string) => g >= finestra.da && g <= finestra.a;
  const voce = (id: string, piattaforma: "meta" | "tiktok", nome?: string | null, campagna?: string | null) => {
    let a = acc.get(id);
    if (!a) {
      a = { ad_id: id, nome: "", campagna: "", piattaforma, spesa: 0, impressioni: 0, v1: 0, v2: 0 };
      acc.set(id, a);
    }
    if (nome && !a.nome) a.nome = nome;
    if (campagna && !a.campagna) a.campagna = campagna;
    return a;
  };
  // Hook rate e hold rate: Meta = 3 secondi / impressioni e thruplay / 3 secondi;
  // TikTok = 2 secondi / impressioni e visto al 75% / 2 secondi.
  // La spesa è quella DELLA RIGA dell'annuncio, non il registro del giorno: una
  // registrazione a mano copre il giorno intero e non si può dividere per annuncio.
  for (const r of ingresso.spesaMeta ?? []) {
    if (!r?.ad_id || !dentro(giornoDi(r.spend_date))) continue;
    const a = voce(r.ad_id, "meta", r.ad_name, r.campaign_name);
    a.spesa += num(r.spend);
    a.impressioni += num(r.impressions);
    a.v1 += num(r.video_3_sec_watched);
    a.v2 += num(r.video_thruplays);
  }
  for (const r of ingresso.spesaTiktok ?? []) {
    if (!r?.ad_id || !dentro(giornoDi(r.spend_date))) continue;
    const a = voce(r.ad_id, "tiktok", r.ad_name, r.campaign_name);
    a.spesa += num(r.spend);
    a.impressioni += num(r.impressions);
    a.v1 += num(r.video_watched_2s);
    a.v2 += num(r.video_views_p75);
  }

  const conta = new Map<string, { lead: number; fissate: number; fatte: number; noShow: number; clienti: number }>();
  for (const r of righe) {
    if (!r.adId || r.giorno < finestra.da || r.giorno > finestra.a) continue;
    const c = conta.get(r.adId) ?? { lead: 0, fissate: 0, fatte: 0, noShow: 0, clienti: 0 };
    if (r.conteggiabile) c.lead++;
    if (r.appuntamento) c.fissate++;
    if (r.fatta) c.fatte++;
    if (r.noShow) c.noShow++;
    if (r.cliente) c.clienti++;
    conta.set(r.adId, c);
    // Un annuncio con lead ma senza righe di spesa nel periodo esiste lo stesso.
    if (!acc.has(r.adId)) {
      const t = r.l.data.tracking;
      const pub = r.l.data.publicLeadId ? pubblici[r.l.data.publicLeadId] : undefined;
      voce(
        r.adId,
        r.canale === "tiktok" ? "tiktok" : "meta",
        t?.ad_name || pub?.ad_name || pub?.creative_name || t?.creative_name,
        t?.campaign_name,
      );
    }
  }

  return [...acc.values()]
    .map((a) => {
      const c = conta.get(a.ad_id) ?? { lead: 0, fissate: 0, fatte: 0, noShow: 0, clienti: 0 };
      return { a, c };
    })
    .filter(({ a, c }) => a.spesa > 0 || c.lead > 0)
    .sort((x, y) => y.a.spesa - x.a.spesa || y.c.lead - x.c.lead)
    .slice(0, 30)
    .map(({ a, c }) => ({
      ad_id: a.ad_id,
      nome: a.nome,
      campagna: a.campagna,
      piattaforma: a.piattaforma,
      slug: slugDalNome(a.nome),
      spesa: tondo(a.spesa),
      impressioni: Math.round(a.impressioni),
      lead: maschera(c.lead),
      fissate: maschera(c.fissate),
      fatte: maschera(c.fatte),
      no_show: maschera(c.noShow),
      clienti: maschera(c.clienti),
      cpl: rapporto(a.spesa, c.lead),
      costo_per_fatta: rapporto(a.spesa, c.fatte),
      hook_rate: a.v1 > 0 && a.impressioni > 0 ? tondo(a.v1 / a.impressioni, 4) : null,
      hold_rate: a.v1 > 0 && a.v2 > 0 ? tondo(a.v2 / a.v1, 4) : null,
    }));
}

const MOTIVI = ["prezzo", "tempo", "concorrenza", "no_show", "non_qualificato", "ripensamento", "non_risponde", "altro"] as const;

// ── IL FEED ─────────────────────────────────────────────────────────────────
export function costruisciFeedKpi(ingresso: IngressoFeed) {
  const adesso = ingresso.adesso;
  const oggi = ingresso.oggi || giornoRoma(adesso.toISOString());
  const w = finestre(oggi);
  const pubblici = ingresso.pubblici ?? {};

  const tutti = (Array.isArray(ingresso.leads) ? ingresso.leads : [])
    .filter((l) => l?.data)
    .map((l) => leggi(l, pubblici));
  // Lead con data illeggibile: non stanno in nessun periodo (come nel CRM).
  const datati = tutti.filter((r) => r.giorno);

  const giorniSpesa = elencoGiorni(primoGiornoNecessario(oggi), oggi);
  const spesa = spesaPerGiorno(giorniSpesa, ingresso);
  const inFinestra = (f: Finestra) => datati.filter((r) => r.giorno >= f.da && r.giorno <= f.a);
  const periodo = (f: Finestra) => kpi(inFinestra(f), sommaSpesa(spesa, f));

  const trenta = inFinestra(w.trenta);
  const spesa30 = sommaSpesa(spesa, w.trenta);

  // ── per piattaforma (ultimi 30 giorni)
  const piattaforma = (canale: "meta" | "tiktok") => {
    const r = trenta.filter((x) => x.canale === canale);
    const lead = r.filter((x) => x.conteggiabile).length;
    const fissate = r.filter((x) => x.appuntamento).length;
    const fatte = r.filter((x) => x.fatta).length;
    const clienti = r.filter((x) => x.cliente).length;
    const s = canale === "meta" ? spesa30.meta : spesa30.tiktok;
    const stimata = canale === "tiktok" ? spesa30.stimata : 0;
    const costo = s + stimata;
    return {
      spesa: tondo(s),
      spesa_stimata: tondo(stimata),
      lead: maschera(lead),
      fissate: maschera(fissate),
      fatte: maschera(fatte),
      clienti: maschera(clienti),
      cpl: rapporto(costo, lead),
      costo_per_fatta: rapporto(costo, fatte),
      cac: rapporto(costo, clienti),
    };
  };
  const org = trenta.filter((x) => x.canale === "organico" || x.canale === "passaparola" || x.canale === "store");

  // ── motivi di perdita (categoria chiusa, ultimi 30 giorni)
  const motivi = Object.fromEntries(MOTIVI.map((m) => [m, 0])) as Record<(typeof MOTIVI)[number], number>;
  for (const r of trenta) {
    const m = r.l.data.lostReason;
    if (!m) continue;
    motivi[(MOTIVI as readonly string[]).includes(m) ? m : "altro"]++;
  }

  // ── tempi (ultimi 30 giorni, mediane)
  const minuti: number[] = [];
  const giorniConsulenza: number[] = [];
  const giorniChiusura: number[] = [];
  for (const r of trenta) {
    const d = r.l.data;
    const creato = new Date(d.createdAt).getTime();
    const primo = d.firstContactAt ? new Date(d.firstContactAt).getTime() : NaN;
    if (Number.isFinite(creato) && Number.isFinite(primo) && primo >= creato) minuti.push((primo - creato) / 60_000);
    const meeting = giornoDi(d.dataMeeting);
    if (r.fatta && meeting) {
      const dist = giorniTra(r.giorno, meeting);
      if (dist >= 0) giorniConsulenza.push(dist);
    }
    if (r.cliente && meeting && d.convertedAt) {
      const chiuso = giornoRoma(d.convertedAt);
      const dist = chiuso ? giorniTra(meeting, chiuso) : -1;
      if (dist >= 0) giorniChiusura.push(dist);
    }
  }
  const arr = (n: number | null, cifre = 0) => (n === null ? null : tondo(n, cifre));

  // ── attese (adesso, su tutti i lead)
  const ora = adesso.getTime();
  const treGiorniFa = sommaGiorni(oggi, -3);
  let daContattare = 0;
  let senzaEsito = 0;
  let inValutazione = 0;
  for (const r of tutti) {
    const d = r.l.data;
    const stato = String(d.stato ?? "");
    const creato = new Date(d.createdAt).getTime();
    // I lead importati da una lista vecchia sono «da contattare» da sempre: non
    // sono in ritardo, sono un archivio.
    if (stato === "da_contattare" && !d.importato && Number.isFinite(creato) && ora - creato > 2 * MS_ORA) daContattare++;
    if (eAppuntamento(stato) && giornoDi(d.dataMeeting) && giornoDi(d.dataMeeting) < treGiorniFa) senzaEsito++;
    if (stato === "sta_valutando") {
      const da = giornoRoma(d.statoPrecedenteIl) || giornoRoma(d.createdAt);
      if (da && giorniTra(da, oggi) > 7) inValutazione++;
    }
  }

  // ── qualità del dato
  const pagati = trenta.filter((r) => r.conteggiabile && (r.canale === "meta" || r.canale === "tiktok"));
  const senzaAnnuncio = pagati.filter((r) => !r.adId).length;
  const ultimo = (righe: { fetched_at?: string | null }[]) => {
    let max = "";
    for (const r of righe ?? []) if (r?.fetched_at && r.fetched_at > max) max = r.fetched_at;
    return max || null;
  };

  const periodi = {
    settimana: { da: w.settimana.da, a: w.settimana.a, kpi: periodo(w.settimana) },
    settimana_prima: { da: w.settimana_prima.da, a: w.settimana_prima.a, kpi: periodo(w.settimana_prima) },
    mese: {
      da: w.mese.da,
      a: w.mese.a,
      giorni_passati: w.mese.giorni_passati,
      giorni_totali: w.mese.giorni_totali,
      kpi: periodo(w.mese),
    },
    mese_prima: { da: w.mese_prima.da, a: w.mese_prima.a, kpi: periodo(w.mese_prima) },
    "30g": { da: w.trenta.da, a: w.trenta.a, kpi: periodo(w.trenta) },
  };

  return {
    versione: 1 as const,
    generato: adesso.toISOString(),
    fuso: FUSO,
    soglia_min: SOGLIA_MIN,
    periodi,
    settimane: w.settimane.map((f) => {
      const r = inFinestra(f);
      const s = sommaSpesa(spesa, f);
      const totale = s.meta + s.tiktok + s.stimata + s.altro;
      const clienti = r.filter((x) => x.cliente).length;
      return {
        da: f.da,
        lead: maschera(r.filter((x) => x.conteggiabile).length),
        fatte: maschera(r.filter((x) => x.fatta).length),
        clienti: maschera(clienti),
        spesa: tondo(totale),
        cac: rapporto(totale, clienti),
      };
    }),
    per_piattaforma: {
      meta: piattaforma("meta"),
      tiktok: piattaforma("tiktok"),
      organico: {
        lead: maschera(org.filter((x) => x.conteggiabile).length),
        fissate: maschera(org.filter((x) => x.appuntamento).length),
        fatte: maschera(org.filter((x) => x.fatta).length),
        clienti: maschera(org.filter((x) => x.cliente).length),
      },
    },
    per_annuncio: perAnnuncio(trenta, w.trenta, ingresso, pubblici),
    motivi_perdita: Object.fromEntries(MOTIVI.map((m) => [m, maschera(motivi[m])])) as Record<(typeof MOTIVI)[number], Conteggio>,
    tempi: {
      prima_risposta_min: arr(mediana(minuti)),
      entro_1h: frazione(minuti.filter((m) => m <= 60).length, minuti.length),
      giorni_lead_consulenza: arr(mediana(giorniConsulenza), 1),
      giorni_consulenza_chiusura: arr(mediana(giorniChiusura), 1),
    },
    attese: {
      da_contattare_oltre_2h: maschera(daContattare),
      fatte_senza_esito_3g: maschera(senzaEsito),
      in_valutazione_oltre_7g: maschera(inValutazione),
    },
    qualita: {
      lead_senza_annuncio_pct: pagati.length ? tondo((senzaAnnuncio / pagati.length) * 100, 1) : 0,
      giorni_tiktok_stimati: spesa30.giorniStimati,
      ultimo_sync_meta: ultimo(ingresso.spesaMeta),
      ultimo_sync_tiktok: ultimo(ingresso.spesaTiktok),
    },
  };
}

export type FeedKpi = ReturnType<typeof costruisciFeedKpi>;
