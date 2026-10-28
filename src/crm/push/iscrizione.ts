/** ── L'ISCRIZIONE DI QUESTO DISPOSITIVO ─────────────────────────────────────
 *  Un posto solo per iscrivere, rinnovare e togliere: lo usano la pagina
 *  Notifiche (il tasto), il motore delle notifiche (rinnovo silenzioso a ogni
 *  apertura del CRM) e l'uscita dal CRM.
 *  ⚠️ IL RINNOVO SILENZIOSO (revisione del 28/10): il browser può cambiare
 *   l'iscrizione da solo, e il server cancella quelle che il servizio dice
 *   morte. Senza rinnovo la pagina direbbe «attive» e non arriverebbe niente.
 *   Se le chiavi del server sono cambiate, l'iscrizione vecchia si rifà.
 *  ⚠️ Non chiede MAI il permesso da solo: rinnova solo dove è già concesso. */
import { intestazioniCRM } from "@/crm/AuthContext";
import { preparaCanaleSistema } from "@/crm/notifications/canale-sistema";
import { aB64url, daB64url } from "./webpush";

export async function chiamaPush(metodo: "GET" | "POST", corpo?: unknown) {
  const r = await fetch("/api/crm/push", {
    method: metodo,
    headers: await intestazioniCRM(corpo ? { "Content-Type": "application/json" } : {}),
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const j = (await r.json().catch(() => ({}))) as {
    chiave?: string | null;
    error?: string;
    ok?: boolean;
  };
  return { ...j, ok: r.ok && j.ok !== false };
}

/** L'iscrizione di questo dispositivo con la chiave giusta: rifatta se era
 *  di una chiave vecchia, creata se `crea` e non c'è. */
async function iscrizioneGiusta(chiave: string, crea: boolean): Promise<PushSubscription | null> {
  const reg = await preparaCanaleSistema();
  if (!reg) return null;
  let iscr = await reg.pushManager.getSubscription();
  const sua = iscr?.options.applicationServerKey;
  if (iscr && sua && aB64url(new Uint8Array(sua)) !== chiave) {
    await iscr.unsubscribe().catch(() => false);
    iscr = null;
    crea = true;
  }
  if (!iscr && crea)
    iscr = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: daB64url(chiave).buffer as ArrayBuffer,
    });
  return iscr;
}

/** Il tasto «Attiva»: chiede il permesso e iscrive. */
export async function iscriviQuesto(chiave: string): Promise<PushSubscription | null> {
  if ((await Notification.requestPermission()) !== "granted") return null;
  const iscr = await iscrizioneGiusta(chiave, true);
  if (!iscr) return null;
  const r = await chiamaPush("POST", { azione: "iscrivi", iscrizione: iscr.toJSON() });
  if (!r.ok) throw new Error(r.error || "server");
  return iscr;
}

/** All'apertura del CRM: se qui le notifiche erano attive, si riconferma
 *  l'iscrizione al server. Silenzioso, non lancia. */
export async function rinnovaQuesto(): Promise<void> {
  try {
    if (typeof window === "undefined" || !("PushManager" in window)) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const reg = await preparaCanaleSistema();
    if (!(await reg?.pushManager.getSubscription())) return;
    const { chiave } = await chiamaPush("GET");
    if (!chiave) return;
    const iscr = await iscrizioneGiusta(chiave, false);
    if (iscr) await chiamaPush("POST", { azione: "iscrivi", iscrizione: iscr.toJSON() });
  } catch {
    /* il rinnovo è un di più: si riprova alla prossima apertura */
  }
}

/** Il tasto «Disattiva» e l'uscita dal CRM: toglie il dispositivo dal server
 *  e dal browser. Non lancia. */
export async function togliQuesto(): Promise<void> {
  try {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const iscr = await reg?.pushManager.getSubscription();
    if (!iscr) return;
    await chiamaPush("POST", { azione: "togli", endpoint: iscr.endpoint }).catch(() => null);
    await iscr.unsubscribe().catch(() => false);
  } catch {
    /* uscire non deve dipendere da questo */
  }
}
