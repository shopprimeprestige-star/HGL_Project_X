/** ─────────────────────────────────────────────────────────────────────────
 *  wa-graph.server.ts — LA CHIAMATA A META, IN COMUNE
 *
 *  Tolto da `routes/api.whatsapp-send.ts` (invio a mano) per usarlo anche nel
 *  motore automatico (`wa-auto-invio.server.ts`), senza copiarlo: due copie
 *  dei codici d'errore di Meta sono due copie che divergono.
 *
 *  ⚠️ NIENTE SUPABASE QUI DENTRO e niente `fetch` globale: la chiamata arriva
 *   da fuori (`fetchFn`), così le prove la sostituiscono con una finta e non
 *   parte mai niente verso WhatsApp. Il comportamento è IDENTICO a quello che
 *   stava nella rotta: stesso indirizzo, stessi messaggi, stesse categorie.
 *  ───────────────────────────────────────────────────────────────────────── */

export const GRAPH = "https://graph.facebook.com/v21.0";

export interface PhoneNumberMeta {
  display_phone_number?: string;
  verified_name?: string;
  error?: { message?: string };
}

export interface MessaggioDaMandare {
  body?: string;
  templateName?: string;
  templateLang?: string;
  /** Parametri posizionali del body del template, in ordine {{1}}, {{2}}, ... */
  templateParams?: unknown[];
}

export interface RispostaGraph {
  messages?: Array<{ id: string }>;
  error?: {
    message: string;
    code?: number;
    error_subcode?: number;
    type?: string;
    error_data?: { details?: string };
    fbtrace_id?: string;
  };
}

/** La parte di `fetch` che serve: così si passa quello vero o uno finto. */
export type FetchGraph = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export function normalizePhone(p: string): string {
  const digits = p.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

export function isMetaTestNumber(meta: PhoneNumberMeta | null): boolean {
  const display = meta?.display_phone_number ?? "";
  return meta?.verified_name === "Test Number" || display.includes("555-");
}

/** Chiede a Meta di che numero si tratta (per riconoscere quello di prova). */
export async function leggiNumero(
  fetchFn: FetchGraph,
  phoneNumberId: string,
  accessToken: string,
): Promise<{ ok: boolean; meta: PhoneNumberMeta }> {
  const res = await fetchFn(`${GRAPH}/${phoneNumberId}?fields=display_phone_number,verified_name`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { ok: res.ok, meta: (await res.json()) as PhoneNumberMeta };
}

/** Modalità LIVE con il numero di PROVA di Meta: si blocca con un errore chiaro. Null se va bene. */
export function erroreModoNonCoerente(
  mode: "live" | "sandbox",
  numeroDiProva: boolean,
  phoneMeta: PhoneNumberMeta,
  phoneNumberId: string,
): Record<string, unknown> | null {
  if (mode !== "live" || !numeroDiProva) return null;
  return {
    error: "test_phone_number_configured",
    code: "mode_mismatch",
    message:
      `Modalità impostata su LIVE ma il Phone Number ID configurato (${phoneMeta.display_phone_number ?? phoneNumberId}) è il numero di TEST Meta. ` +
      "Sostituiscilo con il Phone Number ID del numero WhatsApp Business reale, oppure cambia modalità in Sandbox.",
    hint:
      "Apri Meta → WhatsApp Manager / API Setup del numero live e copia il Phone Number ID del numero finale.",
    raw: phoneMeta,
  };
}

/** Il corpo della richiesta a Meta: template (se c'è il nome) oppure testo libero. */
export function costruisciPayload(to: string, m: MessaggioDaMandare): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to.replace(/^\+/, ""),
  };
  if (m.templateName) {
    payload.type = "template";
    const template: Record<string, unknown> = {
      name: m.templateName,
      language: { code: m.templateLang || "it" },
    };
    const params = m.templateParams;
    if (Array.isArray(params) && params.length > 0) {
      template.components = [
        {
          type: "body",
          parameters: params.map((text) => ({
            type: "text",
            text: String(text ?? ""),
          })),
        },
      ];
    }
    payload.template = template;
  } else {
    payload.type = "text";
    payload.text = { preview_url: false, body: m.body };
  }
  return payload;
}

/** Manda il messaggio. `ok` è falso se HTTP non è 2xx OPPURE Meta scrive `error` nel corpo. Non lancia sugli errori di Meta. */
export async function chiamaGraph(
  fetchFn: FetchGraph,
  phoneNumberId: string,
  accessToken: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: RispostaGraph }> {
  const res = await fetchFn(`${GRAPH}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as RispostaGraph;
  return { ok: res.ok && !json.error, status: res.status, json };
}

/** Che tipo di errore è, e che cosa fare. Lo stesso elenco di sempre. */
export function classificaErrore(
  json: RispostaGraph,
  httpStatus: number,
  numeroDiProva: boolean,
): { category: string; code?: number; sub?: number; msg: string; hint?: string; fullMsg: string } {
  const code = json.error?.code;
  const sub = json.error?.error_subcode;
  const msg = json.error?.message || `HTTP ${httpStatus}`;
  let hint: string | undefined;
  let category = "unknown";
  if (code === 131030) {
    category = "recipient_not_allowed";
    hint = numeroDiProva
      ? "Hai ancora configurato il numero di test Meta. Inserisci il Phone Number ID del numero WhatsApp Business live, altrimenti Meta accetterà solo destinatari whitelisted."
      : "L'app Meta è in Development mode e accetta solo numeri whitelisted. Su Meta for Developers → app → switch 'App mode: Live'. Servono privacy policy URL, business verification e display name WhatsApp approvato.";
  } else if (code === 131031 || code === 131047 || code === 131026) {
    category = "outside_24h_window";
    hint =
      "Sei fuori dalla finestra di 24h. Per messaggi di testo liberi serve che il destinatario ti abbia scritto nelle ultime 24h. Usa un template approvato.";
  } else if (code === 132000 || code === 132001 || code === 132005 || code === 132007 || code === 132012) {
    category = "template_invalid";
    hint = "Template non valido, non approvato o parametri mancanti. Verifica nome, lingua e variabili.";
  } else if (code === 190 || code === 102) {
    category = "token_expired";
    hint = "Access token scaduto o non valido. Rigenera un System User Token permanente con permessi whatsapp_business_messaging + whatsapp_business_management.";
  } else if (code === 200 || code === 10) {
    category = "missing_permission";
    hint = "Permessi insufficienti sul token. Aggiungi whatsapp_business_messaging e whatsapp_business_management e rigenera.";
  } else if (code === 100) {
    category = "bad_parameter";
    hint = "Parametro non valido (Phone Number ID o destinatario). Verifica gli ID Meta nelle impostazioni.";
  } else if (code === 80007 || code === 4) {
    category = "rate_limit";
    hint = "Rate limit Meta raggiunto. Aspetta qualche secondo e riprova.";
  }
  return { category, code, sub, msg, hint, fullMsg: hint ? `${msg} — ${hint}` : msg };
}
