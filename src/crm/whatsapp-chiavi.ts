/** ── LE CHIAVI META: COSA ESCE, COSA SI SCRIVE (modulo puro) ───────────────
 *
 *  Commessa 2026-10-31-anteprima-link (revisione). Il browser non legge né scrive più `access_token`,
 *  `app_secret` e `webhook_verify_token` di `whatsapp_settings` (migrazione 20261031170000): passano da
 *  `/api/crm/whatsapp-chiavi`, che usa queste due regole. Provate in prove/manychat/anteprima-link.mjs.
 *
 *  ⚠️ `statoChiavi`: il token e l'app secret escono SOLO come sì/no. Il verify token esce (il titolare
 *   deve rivederlo per incollarlo in Meta), ma solo dietro il permesso «impostazioni».
 *  ⚠️ `patchChiavi`: un segreto assente o vuoto vuol dire «non toccare», MAI «cancella». Per cancellare
 *   serve `cancella: ["access_token"]`. Così un «Salva» da un form che non conosce il token non lo azzera. */

export const SEGRETI_META = ["access_token", "app_secret", "webhook_verify_token"] as const;
export type SegretoMeta = (typeof SEGRETI_META)[number];

export interface StatoChiavi {
  phone_number_id: string;
  business_account_id: string;
  mode: "live" | "sandbox";
  webhook_verify_token: string;
  haToken: boolean;
  haAppSecret: boolean;
}

/** La riga di `whatsapp_settings` diventa la risposta della rotta: mai il token né l'app secret. */
export function statoChiavi(riga: Record<string, unknown> | null | undefined): StatoChiavi {
  const testo = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    phone_number_id: testo(riga?.phone_number_id),
    business_account_id: testo(riga?.business_account_id),
    mode: riga?.mode === "sandbox" ? "sandbox" : "live",
    webhook_verify_token: testo(riga?.webhook_verify_token),
    haToken: testo(riga?.access_token).trim() !== "",
    haAppSecret: testo(riga?.app_secret).trim() !== "",
  };
}

/** Il corpo del POST diventa le sole colonne da scrivere. */
export function patchChiavi(
  corpo: unknown,
): { ok: true; patch: Record<string, string | null> } | { ok: false; errore: string } {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo))
    return { ok: false, errore: "Richiesta non valida." };
  const c = corpo as Record<string, unknown>;
  const patch: Record<string, string | null> = {};
  //  Gli identificativi non sono segreti: se arrivano, il campo vuoto li svuota davvero.
  for (const k of ["phone_number_id", "business_account_id"] as const) {
    if (c[k] === undefined) continue;
    if (typeof c[k] !== "string") return { ok: false, errore: "Richiesta non valida." };
    patch[k] = (c[k] as string).trim() || null;
  }
  if (c.mode !== undefined) {
    if (c.mode !== "live" && c.mode !== "sandbox")
      return { ok: false, errore: "Modalità non valida." };
    patch.mode = c.mode;
  }
  //  I segreti: solo se c'è un valore. Vuoto o assente = non toccare.
  for (const k of SEGRETI_META) {
    const v = c[k];
    if (v === undefined) continue;
    if (typeof v !== "string") return { ok: false, errore: "Richiesta non valida." };
    if (v.trim() !== "") patch[k] = v.trim();
  }
  //  Cancellare è un gesto esplicito, e solo per i segreti noti.
  if (c.cancella !== undefined) {
    if (!Array.isArray(c.cancella)) return { ok: false, errore: "Richiesta non valida." };
    for (const k of c.cancella) {
      if (!SEGRETI_META.includes(k as SegretoMeta))
        return { ok: false, errore: "Richiesta non valida." };
      patch[k as SegretoMeta] = null;
    }
  }
  return { ok: true, patch };
}
