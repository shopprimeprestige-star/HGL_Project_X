/** ── LE REGOLE DEL TESTO DELL'ANTEPRIMA (pure, senza database) ──────────────
 *  Usate da seo/chi-riceve-il-link.functions (che legge i dati) e dalle pagine
 *  /meetly/CODICE e /preventivo (che scrivono titolo e descrizione). Stanno qui
 *  perché le prove (`npm test`) le possano controllare senza Supabase. */
import { attesoDalGettone, type PersonaAttesa } from "@/crm/fascia-consulenza";

export interface Destinatario {
  nome: string;
  cognome: string;
  /** AAAA-MM-GG, se la consulenza ha una data. */
  giorno?: string;
  /** HH:MM */
  ora?: string;
}

/** Niente che possa uscire dal valore di un meta (virgolette, a capo, tag). */
export const pulito = (v: unknown, max = 60) =>
  String(v ?? "")
    .replace(/[<>"\n\r\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export const codiceStanzaValido = (v: unknown) => {
  const c = String(v ?? "").trim().toLowerCase();
  return /^[a-z0-9-]{6,40}$/.test(c) ? c : "";
};

/** Chi fra gli attesi: quello del gettone; senza gettone solo se è UNO.
 *  ⚠️ In un gruppo senza gettone non si indovina: il nome di un altro cliente
 *   nell'anteprima è proprio il guasto già segnalato una volta. */
export function sceltoFraGliAttesi(attesi: PersonaAttesa[], gettone?: string): PersonaAttesa | null {
  if (gettone) return attesoDalGettone(attesi, gettone) ?? null;
  return attesi.length === 1 ? attesi[0] : null;
}

/** Dalle chiavi `meet:<leadId>` o `meet:<leadId>:<consulente>` che puntano a
 *  una stanza, il lead SOLO se è uno. ⚠️ Le stanze di gruppo condividono il
 *  codice fra più lead: con due lead diversi non si sceglie a caso, si torna
 *  null (meglio il testo generico che il nome di un altro cliente). */
export function leadUnicoDalleChiavi(chiavi: string[]): string {
  const ids = [
    ...new Set(
      chiavi
        .map((k) => String(k || "").split(":")[1]?.trim() || "")
        .filter(Boolean),
    ),
  ];
  return ids.length === 1 ? ids[0] : "";
}

export const nomeCompleto = (d: Destinatario | null | undefined) =>
  d && pulito(d.nome) ? `${pulito(d.nome)}${pulito(d.cognome) ? ` ${pulito(d.cognome)}` : ""}` : "";

/** «Giovedì 15 ottobre alle 18:00», o "" se manca la data. */
export function quandoLeggibile(d: Destinatario | null | undefined): string {
  if (!d?.giorno || !/^\d{4}-\d{2}-\d{2}$/.test(d.giorno)) return "";
  const giorno = new Date(`${d.giorno}T12:00:00Z`).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Rome",
  });
  const testo = giorno.charAt(0).toUpperCase() + giorno.slice(1);
  return d.ora && /^\d{1,2}:\d{2}$/.test(d.ora) ? `${testo} alle ${d.ora}` : testo;
}

export const TESTO_STANZA = {
  titolo: "Meetly — la tua videoconsulenza con Hair Genius Labs",
  descrizione:
    "Tocca per entrare: il tuo consulente ti aspetta. Consulenza personalizzata in video, dal browser, senza installare nulla.",
};
export const TESTO_PREVENTIVO = {
  titolo: "Il tuo preventivo, costruito insieme",
  descrizione: "Scegli tu ogni dettaglio: il prezzo si aggiorna mentre decidi. Nessun pagamento adesso.",
};

/** Titolo e descrizione del link della stanza. Senza persona: quelli di sempre. */
export function testoAnteprimaStanza(d: Destinatario | null | undefined) {
  const nome = nomeCompleto(d);
  if (!nome) return TESTO_STANZA;
  const quando = quandoLeggibile(d);
  return {
    titolo: `${nome} · la tua videoconsulenza Meetly`,
    descrizione: `${quando ? `${quando}. ` : ""}Tocca per entrare: il tuo consulente Hair Genius Labs ti aspetta. Dal browser, senza installare nulla.`,
  };
}

/** Titolo e descrizione del link del preventivo. ⚠️ Mai il prezzo: l'anteprima
 *  la vede chiunque abbia il telefono in mano. */
export function testoAnteprimaPreventivo(d: Destinatario | null | undefined) {
  const nome = nomeCompleto(d);
  if (!nome) return TESTO_PREVENTIVO;
  return {
    titolo: `${nome} · il tuo preventivo Hair Genius Labs`,
    descrizione: "Il preventivo preparato per te in consulenza: rileggilo con calma. Nessun pagamento adesso.",
  };
}

/** Il nome non deve mai far aspettare la pagina: oltre `ms` si va senza. */
export const entro = <T,>(p: Promise<T>, ms = 1500): Promise<T | null> =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]).catch(() => null);
