/** ── LE REGISTRAZIONI DI QUESTO CLIENTE ────────────────────────────────────
 *
 *  Segnalazione del committente: «ora non salva le registrazioni delle
 *  consulenze dentro al CRM».
 *
 *  ── CHE COSA SUCCEDEVA DAVVERO ───────────────────────────────────────────
 *  Le registrazioni si salvavano, eccome: in archivio (2026-09-26) c'erano
 *  dodici schede e i video corrispondenti nella Storage, l'ultimo di
 *  quell'oggi. Quello che mancava era il FILO per ritrovarle dal CRM.
 *
 *  Una registrazione veniva legata a UNA cosa sola: il numero dell'ultimo
 *  preventivo creato in quel browser (`getQuoteRef`). Quindi:
 *   · consulenza in cui NON si è fatto un preventivo → nessun legame. In
 *     archivio erano quattro su sei delle ultime: il video c'è, ma dal CRM non
 *     lo raggiunge nessuno, perché nel CRM si arriva alle registrazioni SOLO
 *     passando da un preventivo;
 *   · e la scheda del cliente prometteva il contrario, per iscritto:
 *     «Preventivo, slide e registrazione restano legati a questo lead».
 *
 *  Adesso la registrazione porta con sé anche il LEAD — chi si aveva davanti,
 *  che durante una consulenza avviata dal CRM è sempre noto — e questa funzione
 *  risponde alla domanda che serve alla scheda: «quali sono le sue?».
 *
 *  ── ⚠️ DUE LEGAMI, TUTTI E DUE DICHIARATI. NESSUNA IPOTESI ───────────────
 *   1. `leadId` scritto sulla registrazione: è il legame certo, e c'è su tutte
 *      quelle nate da qui in avanti.
 *   2. `quoteRef` che è uno dei preventivi di questo lead: vale per quelle di
 *      prima, ed è altrettanto certo — quel preventivo è suo.
 *  NON si indovina per NOME dell'ospite: in una consulenza il cliente scrive
 *  quello che vuole («Gg», «Bb», il nome del figlio), e far comparire il video
 *  di una persona nella scheda di un'altra è un danno che non si ripara. Chi
 *  non ha nessuno dei due legami resta fuori, e nell'archivio del presentatore
 *  si trova lo stesso.
 *
 *  ⚠️ QUI NON SI LEGGE NIENTE DA NESSUNA PARTE: si filtra un elenco già letto.
 *   Così la regola si prova senza database (vedi proveDelleRegistrazioni).
 *  ───────────────────────────────────────────────────────────────────────── */

export interface RegistrazioneArchivio {
  id: string;
  url: string;
  date: string;
  duration: number;
  guestName?: string;
  presenterName?: string;
  /** Il preventivo aperto quando la registrazione si è chiusa, se c'era. */
  quoteRef?: string;
  /** Il cliente che si aveva davanti: il legame certo. */
  leadId?: string;
}

const su = (v: unknown): string => String(v ?? "").trim().toUpperCase();

/** Da quale filo è arrivata: serve alla scheda per dirlo, e a chi legge questo
 *  codice per sapere che non c'è nessun terzo filo nascosto. */
export type FiloDelLead = "lead" | "preventivo";

export interface RegistrazioneDelLead extends RegistrazioneArchivio {
  filo: FiloDelLead;
}

export function registrazioniDelLead(
  tutte: RegistrazioneArchivio[],
  p: { leadId?: string | null; quoteRefs?: (string | null | undefined)[] },
): RegistrazioneDelLead[] {
  const id = String(p.leadId ?? "").trim();
  const suoi = new Set((p.quoteRefs ?? []).map(su).filter(Boolean));
  const fuori: RegistrazioneDelLead[] = [];
  const visti = new Set<string>();
  for (const r of tutte ?? []) {
    if (!r?.url) continue;
    const filo: FiloDelLead | null =
      id && String(r.leadId ?? "").trim() === id
        ? "lead"
        : r.quoteRef && suoi.has(su(r.quoteRef))
          ? "preventivo"
          : null;
    if (!filo) continue;
    //  Una registrazione sola, anche se i due fili portano tutti e due a lei.
    const chiave = r.id || r.url;
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    fuori.push({ ...r, filo });
  }
  //  La più recente in cima: chi apre la scheda cerca quasi sempre l'ultima.
  //  Una data illeggibile va in fondo invece di far saltare l'ordine.
  const quando = (x: RegistrazioneArchivio) => {
    const t = Date.parse(String(x.date ?? ""));
    return Number.isFinite(t) ? t : 0;
  };
  return fuori.sort((a, b) => quando(b) - quando(a));
}

/** Quanto è durata, come lo si dice a voce: «4 min», «1 h 12 min». */
export function durataLeggibile(secondi: unknown): string {
  const s = Math.max(0, Math.round(Number(secondi) || 0));
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const ore = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${ore} h ${resto} min` : `${ore} h`;
}
