import type { Lead } from "./types";

/** ── COSA MANDA IL CRM ALLE PIATTAFORME, E A CHI ───────────────────────────────
 *  Il corpo della richiesta a `capi` (Lead alla creazione della scheda, Purchase alla prima vendita) si costruisce
 *  QUI, in un punto solo e senza dipendenze, così si prova senza browser.
 *
 *  ⚠️ SENZA IL CONSENSO NON ESCE NIENTE. Il consenso marketing lo ha dato (o no) la persona sul sito: il modulo lo
 *   scrive su `public_leads` e `CRM.nuovi-contatti` lo copia sulla scheda (`tracking.consenso_marketing`). Vale solo
 *   `true`: falso, assente, colonna non ancora creata (migrazione S3 non applicata), schede esistenti, a mano,
 *   importate o da Meta Lead Ads — «ignoto» — vuol dire `null`, cioè nessuna richiesta, nessun dato personale, nessun
 *   user agent. Il controllo sta anche in `puoInviareAlleAds` (lead-analytics): qui è la seconda rete, perché chi
 *   costruisce un corpo non deve poterlo fare senza consenso nemmeno per dimenticanza.
 *  ⚠️ NIENTE import a runtime: la prova di `capi` (T29) carica questo file da solo.
 */

/** Il consenso marketing della scheda: solo `true` vero. */
const conConsenso = (lead: Pick<Lead, "data">): boolean => lead.data?.tracking?.consenso_marketing === true;

/** ── L'IDENTIFICATIVO CON CUI META RICONOSCE UN EVENTO ────────────────────
 *  Serve alla deduplica: due invii con lo stesso `event_id` e lo stesso nome
 *  evento sono lo STESSO fatto, e Meta ne conta uno.
 *
 *  ⚠️ QUI SI GENERAVA UN NUMERO A CASO A OGNI CHIAMATA, e così la deduplica
 *   non poteva funzionare nemmeno volendo: lo stesso acquisto rimandato —
 *   perché la vendita era stata riaperta, o perché la prima volta la rete era
 *   caduta — arrivava a Meta con un identificativo mai visto, cioè come un
 *   secondo acquisto. Un identificativo casuale è utile solo se lo si
 *   CONSERVA; generarlo e buttarlo via è il contrario di ciò che serve.
 *   Adesso è l'id del lead: stabile per sempre, uguale a ogni invio, e quindi
 *   la rete di sicurezza di Meta lavora insieme alla nostra (`adsPurchaseIl`).
 *  Resta prioritario `tracking.event_id`, quando c'è: è quello con cui il
 *  pixel del browser ha già annunciato lo stesso fatto, e cambiarlo qui
 *  spezzerebbe la deduplica fra pixel e server, che è la ragione per cui quel
 *  campo esiste. */
export function buildCrmEventId(lead: Pick<Lead, "id" | "data">): string {
  if (lead.data.tracking?.event_id) return lead.data.tracking.event_id;
  return `crm-lead-${lead.id}`;
}

/** Il consenso scritto sulla riga di `public_leads`, com'è da copiare sulla scheda: `true`/`false` se la riga lo dice,
 *  `undefined` (ignoto) se la colonna non c'è o non è un booleano. */
export function consensoDaRiga(riga: unknown): boolean | undefined {
  const v = (riga as { consenso_marketing?: unknown } | null)?.consenso_marketing;
  return typeof v === "boolean" ? v : undefined;
}

/** La richiesta per il `Lead`, o `null` se la scheda non ha il consenso.
 *  `agente`: lo user agent del browser che invia (facoltativo); esce solo dentro un corpo con consenso. */
export function corpoLead(lead: Lead, utenteId: string, sito: string, agente?: string) {
  if (!conConsenso(lead)) return null;
  const t = lead.data.tracking;
  return {
    event_name: "Lead",
    event_id: buildCrmEventId(lead),
    event_source_url: sito,
    admin_user_id: utenteId,
    user_data: {
      email: lead.data.email,
      phone: lead.data.telefono,
      first_name: lead.data.nome,
      last_name: lead.data.cognome,
      city: lead.data.citta,
      fbp: t?.fbp,
      fbc: t?.fbc,
      ttclid: t?.ttclid,
      external_id: t?.external_id,
      user_agent: agente,
    },
    custom_data: {
      value: 1,
      currency: "EUR",
      content_name: "crm_lead",
      ad_id: t?.ad_id,
      adset_id: t?.adset_id,
      campaign_id: t?.campaign_id,
      ad_name: t?.ad_name,
      creative_name: t?.creative_name,
      utm_source: t?.utm_source,
      utm_campaign: t?.utm_campaign,
    },
  };
}

/** La richiesta per il `Purchase` (Offline Conversion), o `null` se manca il consenso o il valore non è > 0. */
export function corpoPurchase(lead: Lead, valore: number, utenteId: string, sito: string) {
  if (!conConsenso(lead)) return null;
  if (!(valore > 0)) return null;
  const t = lead.data.tracking;
  return {
    event_name: "Purchase",
    event_id: `${buildCrmEventId(lead)}-purchase`,
    event_source_url: sito,
    admin_user_id: utenteId,
    source: t?.source,
    user_data: {
      email: lead.data.email,
      phone: lead.data.telefono,
      first_name: lead.data.nome,
      last_name: lead.data.cognome,
      city: lead.data.citta,
      fbp: t?.fbp,
      fbc: t?.fbc,
      ttclid: t?.ttclid,
      external_id: t?.external_id,
    },
    custom_data: {
      value: valore,
      currency: "EUR",
      //  ── ⚠️ QUI ANDAVA `payment.prodotto`, E NON DOVEVA ────────────
      //   Sulla carta quel campo è «il prodotto». Nei dati veri di questo CRM contiene gli appunti della
      //   consulenza (età, mestiere, misure della testa, a volte uno stato di salute). Questa richiesta va a Meta
      //   INSIEME a email, telefono, nome, cognome e città della stessa persona: sarebbe un dato particolare
      //   (GDPR) agganciato a un'identità, vietato anche dalle condizioni di Meta.
      //  ⚠️ QUESTO CAMPO SERVE A RAGGRUPPARE LE CONVERSIONI, non a descrivere il singolo cliente: un'etichetta fissa
      //   fa esattamente il suo mestiere. Se un giorno serviranno più categorie, si scelgano da un elenco chiuso —
      //   mai da un campo scritto a mano.
      content_name: "protesi capillare",
      ad_id: t?.ad_id,
      adset_id: t?.adset_id,
      campaign_id: t?.campaign_id,
      ad_name: t?.ad_name,
      creative_name: t?.creative_name,
      utm_source: t?.utm_source,
      utm_campaign: t?.utm_campaign,
    },
  };
}
