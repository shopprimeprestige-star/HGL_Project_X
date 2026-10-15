/** ── IL NOME DELLA REGISTRAZIONE CHE SI SCARICA DA SOLA ────────────────────
 *
 *  Richiesta del titolare (15/10/2026): «dopo che stoppo il recording della
 *  consulenza me la scarica sul pc in automatico». Nella cartella Download
 *  una registrazione si ritrova se dice QUANDO e CON CHI: data, ora (del
 *  computer di chi registra) e, se il CRM l'ha già scritto, il nome del lead.
 *
 *  ⚠️ Il nome del lead lo digita una persona: accenti, apostrofi, barre,
 *   emoji. Qui diventa solo lettere minuscole, cifre e trattini — nessun
 *   percorso, nessun carattere che Windows o macOS rifiutano.
 *  ⚠️ Solo per il file scaricato: il nome con cui la registrazione sale in
 *   archivio non cambia. */

const LUNGHEZZA_MASSIMA_LEAD = 40;

const due = (n: number) => String(n).padStart(2, "0");

/** «Nicolò D'Angelo» → «nicolo-d-angelo». Vuoto se non resta niente. */
export function nomePulito(testo: string | undefined | null): string {
  return String(testo ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LUNGHEZZA_MASSIMA_LEAD)
    .replace(/-+$/g, "");
}

export function nomeRegistrazione(p: {
  quando: Date;
  lead?: string | null;
  ext: string;
  /** Numero della parte; la prima (o assente) non porta suffisso. */
  parte?: number;
}): string {
  const q = p.quando;
  const data = `${q.getFullYear()}-${due(q.getMonth() + 1)}-${due(q.getDate())}-${due(q.getHours())}${due(q.getMinutes())}`;
  const lead = nomePulito(p.lead);
  const parte = p.parte && p.parte > 1 ? `parte${Math.floor(p.parte)}` : "";
  const ext = p.ext === "mp4" ? "mp4" : "webm";
  return `${["meetly", data, lead, parte].filter(Boolean).join("-")}.${ext}`;
}
