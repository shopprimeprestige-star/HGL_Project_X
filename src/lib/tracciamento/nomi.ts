/*  ── I NOMI DEGLI EVENTI (modulo puro) ──────────────────────────────────────
    Shop R1 · T24 · PIANO §3.4, D16, D17 e tabella §1.9 del documento.

    Qui sta l'unico elenco dei nomi che il sito può mandare alle piattaforme, e la
    mappa fra il nome interno e quello di Meta, TikTok e Google (GA4).

    ⚠️ Nessun nome d'acquisto è ammesso, da nessuna parte: `Purchase`, `CompletePayment`, `Refund`,
       `OrderPlaced`, `PaymentFailed` partono solo dal server, a pagamento confermato (Rilascio 2-3).
       Una prova controlla che nessun elenco, e nessun nome mappato (nemmeno `purchase` di Google), lo contenga. */

/** I nomi che il codice del sito usa (NomeEvento, §3.4). */
export const NOMI_EVENTO = [
  "PageView",
  "ViewContent",
  "Search",
  "AddToCart",
  "RemoveFromCart",
  "ViewCart",
  "InitiateCheckout",
  "AddShippingInfo",
  "AddPaymentInfo",
  "Contact",
  "Subscribe",
  "Lead",
  "BookingDatePick",
  "BookingTimePick",
] as const;
export type NomeEvento = (typeof NOMI_EVENTO)[number];

/** I nomi che il mittente del server (`/api/public/evento`, D16) accetta: la navigazione, senza dati personali.
 *  Senza `Lead`: il Lead nasce dal modulo di consulenza e parte da `capi` con i dati con hash. */
export const NOMI_MITTENTE: readonly NomeEvento[] = NOMI_EVENTO.filter((n) => n !== "Lead");

/** I nomi che `capi` accetta da chi non ha un utente verificato (D17). Una prova li confronta con `capi/filtro.ts`. */
export const NOMI_CAPI_ANONIMI = ["PageView", "ViewContent", "AddToCart", "Lead", "HighQualityVisit", "BookingDatePick", "BookingTimePick"] as const;

/** I nomi che non escono mai dalla navigazione. */
export const NOMI_VIETATI = ["Purchase", "CompletePayment", "Refund", "OrderPlaced", "PaymentFailed"] as const;

type Voce = { meta: string; tiktok: string | null; ga4: string; ga4Lista?: string };
/** Nome interno → nome per piattaforma (`null` = quella piattaforma non lo riceve; tabella §1.9).
 *  `ga4Lista`: il nome di Google quando `ViewContent` riguarda una lista e non una scheda. */
export const MAPPA_NOMI: Record<NomeEvento, Voce> = {
  PageView: { meta: "PageView", tiktok: "PageView", ga4: "page_view" },
  ViewContent: { meta: "ViewContent", tiktok: "ViewContent", ga4: "view_item", ga4Lista: "view_item_list" },
  Search: { meta: "Search", tiktok: "Search", ga4: "search" },
  AddToCart: { meta: "AddToCart", tiktok: "AddToCart", ga4: "add_to_cart" },
  RemoveFromCart: { meta: "RemoveFromCart", tiktok: null, ga4: "remove_from_cart" },
  ViewCart: { meta: "ViewCart", tiktok: null, ga4: "view_cart" },
  InitiateCheckout: { meta: "InitiateCheckout", tiktok: "InitiateCheckout", ga4: "begin_checkout" },
  AddShippingInfo: { meta: "AddShippingInfo", tiktok: null, ga4: "add_shipping_info" },
  AddPaymentInfo: { meta: "AddPaymentInfo", tiktok: "AddPaymentInfo", ga4: "add_payment_info" },
  Contact: { meta: "Contact", tiktok: "Contact", ga4: "contact" },
  Subscribe: { meta: "Subscribe", tiktok: "Subscribe", ga4: "subscribe" },
  // shortcut: a TikTok il Lead va col nome «Lead» come oggi in `capi`, ma la tabella §1.9 lo dà «da verificare» (lo standard potrebbe essere «SubmitForm»), si cambia qui dopo il collaudo con gli «Eventi di prova».
  Lead: { meta: "Lead", tiktok: "Lead", ga4: "generate_lead" },
  BookingDatePick: { meta: "BookingDatePick", tiktok: "BookingDatePick", ga4: "booking_date_pick" },
  BookingTimePick: { meta: "BookingTimePick", tiktok: "BookingTimePick", ga4: "booking_time_pick" },
};

/** Il nome è fra quelli che il mittente del server accetta? Esatto: maiuscole e spazi contano. */
export function nomeAmmesso(nome: unknown): nome is NomeEvento {
  return typeof nome === "string" && (NOMI_MITTENTE as readonly string[]).includes(nome);
}
