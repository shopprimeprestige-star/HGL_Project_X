/** ── LA CASELLA · I MODELLI FUORI FINESTRA (regole pure) ───────────────────
 *
 *  Commessa 2026-10-28, compito T10 (D16). Fuori dalle 24 ore si può mandare
 *  solo un modello approvato. Qui: quali modelli stanno in evidenza (non
 *  chiedono dati), con che valori partono, e quando l'invio è permesso. Niente
 *  React: prove in `prove/manychat/chat-casella.mjs`.
 *
 *  ⚠️ I valori di partenza NON sono gli esempi di Meta («Mario», «18:00»): un
 *   esempio dimenticato in un campo partirebbe al cliente. I campi che non si
 *   conoscono restano vuoti e l'invio li pretende.
 *  ───────────────────────────────────────────────────────────────────────── */
import { MAX_PARAMETRI } from "@/crm/manychat/porta";
import type { MetaTemplate } from "@/crm/wa-meta-templates";

/** Le due variabili che la chat conosce da sola. */
const NOTE = ["lead_name", "consultant_name"];

/** Il modello non chiede altro che il nome del lead e del consulente (D16). */
export function senzaDati(t: MetaTemplate): boolean {
  return t.params.every((p) => NOTE.includes(p.key));
}

/** In evidenza quelli senza dati, sotto gli altri; l'ordine dato resta (D16). */
export function dividiModelli(modelli: MetaTemplate[]): {
  inEvidenza: MetaTemplate[];
  altri: MetaTemplate[];
} {
  return {
    inEvidenza: modelli.filter(senzaDati),
    altri: modelli.filter((t) => !senzaDati(t)),
  };
}

/** I valori di partenza, nell'ordine {{1}}, {{2}}…: nome e consulente se si sanno, il resto vuoto. */
export function valoriIniziali(
  t: MetaTemplate,
  dati: { nomeLead: string; nomeConsulente: string },
): string[] {
  return t.params.map((p) =>
    p.key === "lead_name"
      ? dati.nomeLead.trim()
      : p.key === "consultant_name"
        ? dati.nomeConsulente.trim()
        : "",
  );
}

/** L'invio è permesso? Stesse regole di «Prova i modelli» (`controllaProva`), senza il numero. */
export function controllaModello(
  t: MetaTemplate,
  valori: string[],
  canale: "manychat" | "cloud" | null,
): { ok: true; valori: string[] } | { ok: false; motivo: string } {
  const puliti = t.params.map((_, k) => (valori[k] ?? "").trim());
  for (const [k, p] of t.params.entries()) {
    const v = puliti[k];
    if (!v) return { ok: false, motivo: `Manca un valore: ${p.description}.` };
    //  Meta rifiuta (132018) a capo, tabulazioni e 4 spazi di fila in una variabile.
    if (/[\n\r\t]| {4}/.test(v))
      return {
        ok: false,
        motivo: `Il valore «${p.description}» non può avere a capo, tabulazioni o quattro spazi di fila.`,
      };
  }
  if (canale === "manychat" && t.params.length > MAX_PARAMETRI)
    return {
      ok: false,
      motivo: `Il modello ha ${t.params.length} variabili: ManyChat ne accetta al massimo ${MAX_PARAMETRI}.`,
    };
  return { ok: true, valori: puliti };
}

/* ── IL MODELLO CONSIGLIATO (29/10/2026) ──────────────────────────────────
 *  Richiesta del titolare: con la finestra di 24 ore chiusa «il CRM capisce
 *  quale messaggio volevo mandare e invia il template corretto, se è un
 *  reminder o altro». Dallo stato della scheda (e dalla data della
 *  consulenza) si sceglie il modello, con i valori già messi: la casella
 *  apre direttamente la sua anteprima e basta un tocco su «Invia».
 *  Fra i candidati vale il primo che il canale permette (`modelli`).
 *  ⚠️ Mai un valore inventato: un campo che non si sa resta vuoto e l'invio
 *   lo chiede, come per gli altri modelli. */
export interface DatiConsigliato {
  stato?: string;
  dataMeeting?: string;
  oraMeeting?: string;
  linkMeeting?: string;
  dataRicontatto?: string;
  oraRicontatto?: string;
}

/** Quanto manca alla consulenza di oggi, in minuti (`null` se non si sa). */
const minutiAllaConsulenza = (ora: string | undefined, adessoMin: number | undefined) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(ora ?? "");
  if (!m || adessoMin === undefined) return null;
  return Number(m[1]) * 60 + Number(m[2]) - adessoMin;
};

const piuGiorni = (data: string, n: number) => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** I nomi dei modelli adatti, dal più adatto. Vuoto se nessuno ha senso. */
export function candidatiPerStato(
  d: DatiConsigliato | null | undefined,
  oggi: string,
  /** i minuti dalla mezzanotte, ora di Roma */
  adessoMin?: number,
): string[] {
  if (!d) return [];
  const giorno = /^\d{4}-\d{2}-\d{2}/.test(d.dataMeeting ?? "") ? d.dataMeeting!.slice(0, 10) : "";
  switch (d.stato) {
    case "appuntamento_fissato":
    case "appuntamento_rifissato":
      if (!giorno) return ["hgl_meet_da_fissare"];
      if (giorno === oggi) {
        //  «Tra una ventina di minuti… il link è questo» solo quando è vero
        //  (revisione del 29/10): prima, «ci vediamo oggi alle…».
        const mancano = minutiAllaConsulenza(d.oraMeeting, adessoMin);
        const traPoco = mancano !== null && mancano >= -15 && mancano <= 35;
        return d.linkMeeting && traPoco
          ? ["hgl_promemoria_meet", "hgl_meet_oggi"]
          : ["hgl_meet_oggi"];
      }
      if (giorno === piuGiorni(oggi, 1)) return ["hgl_meet_domani", "consulenza_conferma_presenza"];
      if (giorno > oggi) return ["consulenza_conferma_presenza", "appuntamento_conferma"];
      //  «Oggi non siamo riusciti a vederci» solo per ieri o oggi.
      return giorno >= piuGiorni(oggi, -1)
        ? ["hgl_cliente_assente", "hgl_da_riprogrammare"]
        : ["hgl_da_riprogrammare"];
    case "da_contattare":
      return ["hgl_primo_contatto", "hgl_primo_contatto_tre_fasce"];
    case "attesa_whatsapp":
      return ["hgl_richiamo_24h", "hgl_non_risponde"];
    case "da_chiamare":
    case "non_risponde":
    case "segreteria":
      return ["hgl_non_risponde", "hgl_richiamo_24h"];
    case "richiamo":
      //  «Come d'accordo la chiamo OGGI alle…» solo se il richiamo è oggi.
      return d.oraRicontatto && (d.dataRicontatto ?? "").slice(0, 10) === oggi
        ? ["hgl_richiamo_concordato", "hgl_ricontatto_consulenza"]
        : ["hgl_ricontatto_consulenza"];
    case "da_spostare":
    case "non_fatto":
      return ["hgl_da_riprogrammare", "hgl_cliente_assente"];
    case "fatto":
      return ["hgl_ricontatto_consulenza"];
    default:
      return [];
  }
}

/** I valori del modello consigliato: quelli che la scheda sa, il resto vuoto. */
export function valoriConsigliati(
  t: MetaTemplate,
  d: DatiConsigliato,
  dati: { nomeLead: string; nomeConsulente: string },
  oggi: string,
  giornoParlato: (g: string) => string | null,
): string[] {
  const giorno = (d.dataMeeting ?? "").slice(0, 10);
  const giornoDetto = giorno === oggi ? "oggi" : (giornoParlato(giorno) ?? "");
  const base = valoriIniziali(t, dati);
  return t.params.map((p, k) => {
    switch (p.key) {
      case "appointment_day":
      case "appointment_date":
        return /^\d{4}-\d{2}-\d{2}$/.test(giorno) ? giornoDetto : "";
      case "appointment_time":
        return (d.oraMeeting ?? "").trim();
      case "meet_link":
        return (d.linkMeeting ?? "").trim();
      case "recontact_time":
        return (d.oraRicontatto ?? "").trim();
      default:
        return base[k] ?? "";
    }
  });
}

/** Il modello da aprire subito, coi suoi valori; `null` se non ce n'è uno adatto. */
export function modelloConsigliato(
  modelli: MetaTemplate[],
  d: DatiConsigliato | null | undefined,
  dati: { nomeLead: string; nomeConsulente: string },
  oggi: string,
  giornoParlato: (g: string) => string | null,
  adessoMin?: number,
): { modello: MetaTemplate; valori: string[] } | null {
  for (const nome of candidatiPerStato(d, oggi, adessoMin)) {
    const t =
      modelli.find((m) => m.name === nome) ??
      modelli.find((m) => m.name.replace(/_v\d+$/, "") === nome);
    if (t && d) return { modello: t, valori: valoriConsigliati(t, d, dati, oggi, giornoParlato) };
  }
  return null;
}
