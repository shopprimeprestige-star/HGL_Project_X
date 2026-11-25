/** ── SHOP R1 · T34 · IL CRM MANDA ALLE PIATTAFORME SOLO CIÒ CHE HA IL CONSENSO REGISTRATO (D32) ──
 *  `src/crm/lead-ads.ts` è puro (nessun import a runtime: lo carica anche la prova di T29 senza impacchettare);
 *  `lead-analytics.ts` ha `puoInviareAlleAds`; `CRMContext.tsx` si prova sul testo (è un componente React).
 *  Regola: `consenso_marketing === true` sulla scheda, altrimenti (falso, assente, colonna mancante) NIENTE parte.
 *  Dati: tutti inventati (example.invalid). */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { transformSync } from "esbuild";

const caricaTs = (percorso) =>
  import(`data:text/javascript;base64,${Buffer.from(transformSync(readFileSync(percorso, "utf8"), { loader: "ts", format: "esm" }).code).toString("base64")}`);
const SITO = "https://hair-genius-hub.hair";

/** Il testo senza commenti (di riga e di blocco): si cerca nel codice, non nei cartelli. */
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

function sorgenti(cartella, acc = []) {
  for (const f of readdirSync(cartella)) {
    const p = join(cartella, f);
    if (statSync(p).isDirectory()) sorgenti(p, acc);
    else if (/\.(ts|tsx)$/.test(f) && !f.endsWith(".d.ts")) acc.push(p);
  }
  return acc;
}

/** Una scheda del CRM inventata, da campagna Meta, con il consenso scelto. */
const scheda = (consenso, extra = {}) => ({
  id: "lead-1",
  created_at: "2026-11-01T10:00:00Z",
  updated_at: "2026-11-01T10:00:00Z",
  user_id: "u1",
  data: {
    nome: "Anna", cognome: "Verdi", telefono: "+390000000000", email: "anna@example.invalid", citta: "Roma",
    fonte: "ADV", piattaformaAds: "meta",
    payment: { prodotto: "53 anni marittimo, ha malattia a lavoro" },
    tracking: {
      source: "meta", fbp: "fb.1.1", fbc: "fb.1.2.abc", ttclid: "tt1", external_id: "ext-1", ad_id: "ad1", adset_id: "as1",
      campaign_id: "c1", ad_name: "Video 1", creative_name: "Cr1", utm_source: "meta", utm_campaign: "camp",
      ...(consenso === undefined ? {} : { consenso_marketing: consenso }),
    },
    ...extra,
  },
});

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("SHOP R1 · T34 · IL CRM MANDA ALLE PIATTAFORME SOLO CON IL CONSENSO (20/11/2026)");
  const pAds = join(radice, "src/crm/lead-ads.ts");
  const LA = mod["lead-analytics"];
  c("lead-ads.ts esiste e lead-analytics ha puoInviareAlleAds", [true, "function"], [existsSync(pAds), typeof LA?.puoInviareAlleAds]);
  if (!existsSync(pAds) || typeof LA?.puoInviareAlleAds !== "function") return;
  const L = await caricaTs(pAds);
  const puo = LA.puoInviareAlleAds;

  /* ── 1 · puoInviareAlleAds: la regola in una riga ── */
  c("campagna + consenso true → sì", true, puo(scheda(true)));
  c("campagna + consenso false → NO", false, puo(scheda(false)));
  c("campagna + consenso ignoto (lead esistente, creato a mano, importato, Meta Lead Ads) → NO", false, puo(scheda(undefined)));
  c("consenso non booleano (\"true\", 1, null) → NO: vale solo `true` vero", [false, false, false],
    ["true", 1, null].map((v) => puo(scheda(v))));
  c("passaparola/Store con consenso true → NO (come prima: non è un lead da campagna)", false,
    puo({ data: { fonte: "Store", tracking: { consenso_marketing: true } } }));
  c("scheda senza `tracking` → NO, senza errori", false, puo({ data: { fonte: "ADV" } }));
  c("shouldDispatchLeadToAds non cambia (ADV senza consenso resta vero: è la regola di prima)", [true, false],
    [LA.shouldDispatchLeadToAds(scheda(undefined)), LA.shouldDispatchLeadToAds({ data: { fonte: "Store" } })]);

  /* ── 2 · corpoLead ── */
  const agente = "Mozilla/5.0 (finto)";
  const conL = L.corpoLead(scheda(true), "u1", SITO, agente);
  c("corpoLead con consenso: Lead, event_id del tracking o crm-lead-<id>, chi ha scritto", ["Lead", "crm-lead-lead-1", "u1"], [conL?.event_name, conL?.event_id, conL?.admin_user_id]);
  c("corpoLead: email, telefono, nome, cognome e città nello user_data", ["anna@example.invalid", "+390000000000", "Anna", "Verdi", "Roma"],
    [conL?.user_data?.email, conL?.user_data?.phone, conL?.user_data?.first_name, conL?.user_data?.last_name, conL?.user_data?.city]);
  c("corpoLead: fbp, fbc, ttclid, external_id e lo user agent passato", ["fb.1.1", "fb.1.2.abc", "tt1", "ext-1", agente],
    [conL?.user_data?.fbp, conL?.user_data?.fbc, conL?.user_data?.ttclid, conL?.user_data?.external_id, conL?.user_data?.user_agent]);
  c("corpoLead: custom_data come oggi (valore 1 EUR, crm_lead, annuncio e campagna)", [1, "EUR", "crm_lead", "ad1", "as1", "c1", "Video 1", "Cr1", "meta", "camp"],
    ((d) => [d?.value, d?.currency, d?.content_name, d?.ad_id, d?.adset_id, d?.campaign_id, d?.ad_name, d?.creative_name, d?.utm_source, d?.utm_campaign])(conL?.custom_data));
  c("corpoLead usa l'event_id del pixel, se la scheda lo ricorda (deduplica)", "ev-pixel",
    L.corpoLead({ ...scheda(true), data: { ...scheda(true).data, tracking: { ...scheda(true).data.tracking, event_id: "ev-pixel" } } }, "u1", SITO)?.event_id);
  c("corpoLead senza consenso (false, assente, non booleano) → null", [null, null, null, null],
    [false, undefined, "true", null].map((v) => L.corpoLead(scheda(v), "u1", SITO, agente)));
  c("corpoLead senza consenso: lo user agent non esce da nessuna parte (nessun corpo)", false, JSON.stringify(L.corpoLead(scheda(undefined), "u1", SITO, agente)).includes(agente));
  c("corpoLead: event_source_url è il sito, mai un indirizzo del CRM", [SITO, false], [conL?.event_source_url, /\/CRM/i.test(conL?.event_source_url ?? "/CRM")]);

  /* ── 3 · corpoPurchase (la prova di T29 lo cerca con questo nome) ── */
  const conP = L.corpoPurchase(scheda(true), 1200, "u1", SITO);
  c("corpoPurchase con consenso e valore > 0: Purchase, event_id che finisce con -purchase, value, EUR", ["Purchase", true, 1200, "EUR"],
    [conP?.event_name, /-purchase$/.test(conP?.event_id ?? ""), conP?.custom_data?.value, conP?.custom_data?.currency]);
  c("corpoPurchase: stesso event_id del Lead + «-purchase» (la deduplica di Meta lavora)", `${conL?.event_id}-purchase`, conP?.event_id);
  c("corpoPurchase: email, telefono, nome, cognome, città, fbp, fbc, ttclid, external_id; source dalla scheda", ["anna@example.invalid", "+390000000000", "Anna", "Verdi", "Roma", "fb.1.1", "fb.1.2.abc", "tt1", "ext-1", "meta"],
    [conP?.user_data?.email, conP?.user_data?.phone, conP?.user_data?.first_name, conP?.user_data?.last_name, conP?.user_data?.city, conP?.user_data?.fbp, conP?.user_data?.fbc, conP?.user_data?.ttclid, conP?.user_data?.external_id, conP?.source]);
  c("corpoPurchase: etichetta fissa «protesi capillare» e nessun appunto della consulenza (payment.prodotto non esce)", ["protesi capillare", false, false],
    [conP?.custom_data?.content_name, JSON.stringify(conP).includes("marittimo"), "prodotto" in (conP?.custom_data ?? {})]);
  c("corpoPurchase: nessun user_agent (non c'è oggi e non nasce adesso)", false, "user_agent" in (conP?.user_data ?? {}));
  c("corpoPurchase: valore 0, negativo, vuoto o non numero → null", [null, null, null, null], [0, -5, undefined, NaN].map((v) => L.corpoPurchase(scheda(true), v, "u1", SITO)));
  c("corpoPurchase senza consenso (false, assente) con valore > 0 → null", [null, null], [false, undefined].map((v) => L.corpoPurchase(scheda(v), 1200, "u1", SITO)));
  c("corpoPurchase: event_source_url è il sito, mai /CRM", [SITO, false], [conP?.event_source_url, /\/CRM/i.test(conP?.event_source_url ?? "/CRM")]);

  /* ── 4 · da `public_leads` alla scheda: consensoDaRiga ── */
  const da = L.consensoDaRiga;
  c("consensoDaRiga: true → true, false → false", [true, false], [da({ consenso_marketing: true }), da({ consenso_marketing: false })]);
  c("consensoDaRiga: colonna assente (S3 non applicata), null, testo, numero → undefined (ignoto)", [undefined, undefined, undefined, undefined, undefined],
    [da({}), da({ consenso_marketing: null }), da({ consenso_marketing: "true" }), da({ consenso_marketing: 1 }), da(null)]);

  /* ── 5 · l'Offline Conversion continua: prova incrociata con filtro.ts di T29 ── */
  const pFiltro = join(radice, "supabase/functions/capi/filtro.ts");
  if (existsSync(pFiltro)) {
    const { decidi } = await caricaTs(pFiltro);
    c("il Purchase del CRM con il JWT del proprietario passa dal filtro di capi; con la sola apikey NO", [true, false], [
      decidi({ nome: conP?.event_name, autenticato: true, membroCrm: true }).ok,
      decidi({ nome: conP?.event_name, autenticato: false, membroCrm: false }).ok,
    ]);
    c("il Lead del CRM passa anche senza JWT (nome dell'elenco): la scheda aperta col codice vecchio non perde i Lead", true,
      decidi({ nome: conL?.event_name, autenticato: false, membroCrm: false }).ok);
  }

  /* ── 6 · CRMContext.tsx, sul testo: la porta è chiusa e niente è stato tolto ── */
  const ctxIntero = readFileSync(join(radice, "src/crm/CRMContext.tsx"), "utf8");
  const ctx = senzaCommenti(ctxIntero);
  const blocco = (nome) => (ctx.match(new RegExp(`const ${nome} = useCallback\\([\\s\\S]*?\\n {2}\\);\\n`)) ?? [""])[0];
  const lead = blocco("dispatchLeadToAds");
  const acq = blocco("dispatchPurchaseToAds");
  const capi = blocco("dispatchToCapi");
  c("le tre funzioni si trovano nel sorgente", [true, true, true], [lead.length > 0, acq.length > 0, capi.length > 0]);
  const prima = (b, a, d) => b.indexOf(a) >= 0 && b.indexOf(d) > b.indexOf(a);
  c("dispatchLeadToAds: il corpo si costruisce con corpoLead PRIMA di dispatchToCapi, e senza corpo si esce", [true, true],
    [prima(lead, "corpoLead(", "dispatchToCapi("), /if \(!corpo\) return;/.test(lead)]);
  c("dispatchPurchaseToAds: il corpo si costruisce con corpoPurchase PRIMA di dispatchToCapi, e senza corpo si esce", [true, true],
    [prima(acq, "corpoPurchase(", "dispatchToCapi("), /if \(!corpo\) return;/.test(acq)]);
  c("entrambe chiedono anche puoInviareAlleAds (consenso) e non più solo shouldDispatchLeadToAds", [true, true, false, false],
    [/puoInviareAlleAds\(lead\)/.test(lead), /puoInviareAlleAds\(lead\)/.test(acq), /shouldDispatchLeadToAds\(/.test(lead), /shouldDispatchLeadToAds\(/.test(acq)]);
  c("dispatchToCapi manda il JWT della sessione: getSession e Authorization Bearer (oltre ad apikey)", [true, true, true],
    [/getSession\(\)/.test(capi), /Authorization/.test(capi), /apikey/.test(capi)]);
  c("l'indirizzo del CRM non va più alle piattaforme: window.location non compare in dispatch*ToAds", [false, false],
    [/window\.location/.test(lead), /window\.location/.test(acq)]);
  c("l'indirizzo che esce è SITO (da src/lib/sito)", [true, true, true],
    [/import \{[^}]*\bSITO\b[^}]*\} from "@\/lib\/sito"/.test(ctx), /SITO/.test(lead), /SITO/.test(acq)]);
  c("lo user agent esce solo dentro il corpo (corpoLead), mai fuori dal controllo del consenso", [false, true],
    [/user_agent/.test(lead + acq), /navigator\.userAgent/.test(lead)]);
  c("niente è stato tolto: createLead chiama ancora dispatchLeadToAds, updateLead dispatchPurchaseToAds (alla prima vittoria)", [true, true],
    [/void dispatchLeadToAds\(lead\);/.test(ctx), /if \(primoAnnuncio\) \{\s*void dispatchPurchaseToAds\(updatedLead, leadRevenue\(updatedLead\)\);/.test(ctx)]);
  c("la deduplica di prima: l'event_id si costruisce ancora con buildCrmEventId (scelta del pixel, poi crm-lead-<id>)", true,
    /buildCrmEventId/.test(ctx) || /buildCrmEventId/.test(readFileSync(pAds, "utf8")));

  /* ── 7 · i percorsi da `public_leads` a `crm_leads` (nota B del revisore) ── */
  const file = sorgenti(join(radice, "src")).filter((p) => !p.includes("/integrations/"));
  const rel = (p) => p.slice(radice.length + 1);
  const testo = (p) => readFileSync(p, "utf8");
  const scrittori = file.filter((p) => /public_leads|PublicLead/.test(testo(p)) && /\bcreateLead\(|crm_leads["']\)\s*\.(insert|upsert)\(/.test(senzaCommenti(testo(p))));
  //  LeadDialog nomina `public_leads` solo per LEGGERE il percorso del cliente (PercorsoCliente) e crea schede a mano.
  c("i file che nominano public_leads e creano schede: CRM.nuovi-contatti (il percorso vero) e LeadDialog (scheda a mano, legge solo il percorso)",
    ["src/crm/LeadDialog.tsx", "src/routes/CRM.nuovi-contatti.tsx"], scrittori.map(rel).sort());
  const legami = file.filter((p) => /publicLeadId:\s*\w/.test(senzaCommenti(testo(p))));
  c("l'unico punto che scrive `publicLeadId` su una scheda è `assign` di CRM.nuovi-contatti", ["src/routes/CRM.nuovi-contatti.tsx"], legami.map(rel));
  const dentroDb = [...readdirSync(join(radice, "supabase/migrations"))].filter((f) => f.endsWith(".sql"))
    .filter((f) => { const t = testo(join(radice, "supabase/migrations", f)).replace(/--.*$/gm, ""); return /insert\s+into\s+(public\.)?crm_leads[\s\S]{0,400}?public_leads|public_leads[\s\S]{0,400}?insert\s+into\s+(public\.)?crm_leads/i.test(t); });
  c("nessuna funzione o trigger del database copia public_leads in crm_leads", [], dentroDb);
  const nuovi = senzaCommenti(testo(join(radice, "src/routes/CRM.nuovi-contatti.tsx")));
  const assign = (nuovi.match(/const assign = async[\s\S]*?const created = await createLead\(leadData\);/) ?? [""])[0];
  c("assign copia il consenso della riga sulla scheda (tracking.consenso_marketing) con consensoDaRiga", [true, true],
    [/consenso_marketing:\s*consensoDaRiga\(p\)/.test(assign), /import \{[^}]*\bconsensoDaRiga\b[^}]*\} from "@\/crm\/lead-ads"/.test(nuovi)]);
  const tipi = senzaCommenti(testo(join(radice, "src/crm/types.ts")));
  c("types.ts: TrackingInfo ha consenso_marketing?: boolean (un solo campo)", true, /interface TrackingInfo \{[\s\S]*?consenso_marketing\?: boolean;/.test(tipi));
  c("types.ts: PublicLead non cambia (le colonne di S3 mancano nei tipi generati: aggiungerle romperebbe l'update tipizzato di `mutate`)", false, /interface PublicLead \{[\s\S]*?consenso_/.test(tipi.split("export function detectPublicLeadSource")[0]));
  c("src/integrations/supabase/types.ts non è toccato da T34 (nessuna colonna del consenso lì dentro)", false,
    /consenso_marketing/.test(testo(join(radice, "src/integrations/supabase/types.ts"))));
  c("lead-ads.ts non importa niente a runtime (si carica da solo, anche dalla prova di T29)", [], (readFileSync(pAds, "utf8").match(/^import (?!type)[^\n]*$/gm) ?? []));
}
