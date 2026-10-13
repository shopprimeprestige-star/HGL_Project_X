/** ── GOOGLE DRIVE, LATO SERVER ──────────────────────────────────────────────
 *
 *  Le chiavi dell'applicazione Google (id e segreto) e il permesso dato dal
 *  titolare (il «refresh token») stanno in app_config, in due righe:
 *    · google_drive_secret  { clientId, clientSecret }
 *    · google_drive_token   { refresh_token, folderId, email }
 *  Tutte e due cadono nelle chiavi RISERVATE (/secret/, /token/): non escono
 *  mai nei backup né nelle copie (crm/copia-sezioni).
 *
 *  ⚠️ IL PERMESSO È IL PIÙ STRETTO CHE GOOGLE DÀ: `drive.file` vede SOLO i file
 *   che questa applicazione ha creato. Il resto del Drive non si legge e non si
 *   tocca, neanche volendo.
 *  ⚠️ IL FILE NON PASSA DA QUI. Il server apre una «sessione di caricamento»
 *   e la consegna al browser, che manda i byte direttamente a Google: un Worker
 *   non tiene in memoria un'ora di video (vedi api.presenter.upload-url).
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const CHIAVE_SEGRETO = "google_drive_secret";
export const CHIAVE_TOKEN = "google_drive_token";
export const CHIAVE_STATO = "google_drive_oauth_state";
export const CARTELLA = "Registrazioni Meetly";
export const AMBITO = "https://www.googleapis.com/auth/drive.file";

export type Segreto = { clientId: string; clientSecret: string };
export type Collegamento = { refresh_token: string; folderId: string; email: string };

async function leggi<T>(key: string): Promise<T | null> {
  try {
    const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", key).maybeSingle();
    const v = (data as { value?: unknown } | null)?.value;
    if (v == null) return null;
    return (typeof v === "string" ? JSON.parse(v) : v) as T;
  } catch {
    return null;
  }
}

export async function scrivi(key: string, value: unknown): Promise<void> {
  await supabaseAdmin
    .from("app_config")
    .upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() } as never, { onConflict: "key" });
}

export async function togli(key: string): Promise<void> {
  await supabaseAdmin.from("app_config").delete().eq("key", key);
}

export async function leggiSegreto(): Promise<Segreto | null> {
  const s = await leggi<Partial<Segreto>>(CHIAVE_SEGRETO);
  if (!s?.clientId || !s?.clientSecret) return null;
  return { clientId: String(s.clientId), clientSecret: String(s.clientSecret) };
}

export async function leggiCollegamento(): Promise<Collegamento | null> {
  const c = await leggi<Partial<Collegamento>>(CHIAVE_TOKEN);
  if (!c?.refresh_token) return null;
  return { refresh_token: String(c.refresh_token), folderId: String(c.folderId || ""), email: String(c.email || "") };
}

/** Il ritorno da Google: deve essere IDENTICO a quello scritto nella console
 *  Google, quindi lo si costruisce sempre allo stesso modo dall'origine. */
export const indirizzoRitorno = (origine: string) => `${origine}/api/google-drive/callback`;

/** Il permesso d'accesso di un'ora, dal permesso lungo. */
export async function accessoDrive(): Promise<{ token: string; collegamento: Collegamento } | { errore: string }> {
  const s = await leggiSegreto();
  if (!s) return { errore: "chiavi Google non impostate" };
  const c = await leggiCollegamento();
  if (!c) return { errore: "Google Drive non collegato" };
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: s.clientId,
      client_secret: s.clientSecret,
      refresh_token: c.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!r.ok || !j.access_token) return { errore: `Google ha rifiutato l'accesso (${j.error || r.status}): ricollega Drive` };
  return { token: j.access_token, collegamento: c };
}

/** La cartella delle registrazioni: la si crea una volta, al collegamento. */
export async function creaCartella(token: string): Promise<string> {
  const r = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: CARTELLA, mimeType: "application/vnd.google-apps.folder" }),
  });
  const j = (await r.json().catch(() => ({}))) as { id?: string };
  return j.id || "";
}

/** Apre una sessione di caricamento a riprese e ne restituisce l'indirizzo.
 *  ⚠️ `Origin`: Google concede al browser di scrivere su quell'indirizzo solo
 *   se la sessione è stata aperta dichiarando la stessa origine del sito. */
export async function apriCaricamento(p: {
  nome: string;
  peso: number;
  tipo: string;
  origine: string;
}): Promise<{ ok: true; sessione: string } | { ok: false; errore: string }> {
  const a = await accessoDrive();
  if ("errore" in a) return { ok: false, errore: a.errore };
  let cartella = a.collegamento.folderId;
  const apri = (parents: string[]) =>
    fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${a.token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": p.tipo,
        "X-Upload-Content-Length": String(p.peso),
        Origin: p.origine,
      },
      body: JSON.stringify({ name: p.nome, mimeType: p.tipo, ...(parents.length ? { parents } : {}) }),
    });
  let r = await apri(cartella ? [cartella] : []);
  //  La cartella può essere stata cancellata a mano dal Drive: se ne rifà una.
  if (r.status === 404 && cartella) {
    cartella = await creaCartella(a.token);
    if (cartella) await scrivi(CHIAVE_TOKEN, { ...a.collegamento, folderId: cartella });
    r = await apri(cartella ? [cartella] : []);
  }
  const sessione = r.headers.get("Location") || r.headers.get("location") || "";
  if (!r.ok || !sessione) {
    const t = await r.text().catch(() => "");
    return { ok: false, errore: `Drive non apre il caricamento (${r.status}) ${t.slice(0, 160)}` };
  }
  return { ok: true, sessione };
}
