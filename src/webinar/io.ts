/** ── CHI SONO, DA QUESTO BROWSER ────────────────────────────────────────────
 *  Un numero casuale e un nome. Il numero serve a non contare due volte la
 *  stessa scheda e a riconoscere chi il presentatore ha fatto salire; il nome
 *  è quello che compare in chat.
 *
 *  ⚠️ NON È UN ACCOUNT e non deve diventarlo. A un webinar su un trattamento
 *   della persona si arriva da un link, e chiedere di registrarsi per entrare
 *   è il modo più veloce di svuotare la sala. Qui non c'è niente da ricordare
 *   e niente da recuperare: se il numero si perde, se ne fa un altro. */
const CHIAVE_ID = "hg_webinar_id";
const CHIAVE_NOME = "hg_webinar_nome";

export function mioId(): string {
  if (typeof window === "undefined") return "";
  try {
    let v = localStorage.getItem(CHIAVE_ID) || "";
    if (!v) {
      v = crypto?.randomUUID?.().replace(/-/g, "") || Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(CHIAVE_ID, v);
    }
    return v;
  } catch {
    //  Navigazione privata o archivio negato: si vive lo stesso, ma ricaricando
    //  la pagina si viene contati come una persona nuova. Meglio che non
    //  entrare affatto.
    return Math.random().toString(36).slice(2);
  }
}

export function mioNome(): string {
  if (typeof window === "undefined") return "";
  try { return localStorage.getItem(CHIAVE_NOME) || ""; } catch { return ""; }
}

export function salvaNome(n: string): void {
  try { localStorage.setItem(CHIAVE_NOME, String(n || "").trim().slice(0, 60)); } catch { /* pazienza */ }
}
