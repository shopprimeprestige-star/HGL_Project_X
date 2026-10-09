/** ── LE SPESE FISSE DEL MESE ───────────────────────────────────────────────
 *
 *  Affitto, luce, acqua, gas, fibra, commercialista, abbonamenti, manutenzioni:
 *  quello che si paga per tenere aperto, e che non appartiene a nessun cliente
 *  in particolare. I costi di una pratica stanno sulla pratica
 *  (crm/costi-pratica); questi stanno sul MESE.
 *
 *  ── ⚠️ PERCHÉ UN ELENCO PER MESE E NON UN ELENCO DI COSTI RICORRENTI ──────
 *  Sembra più furbo scrivere «affitto 900 €/mese» una volta sola e lasciare che
 *  si ripeta da solo. È più furbo finché non succede la realtà: l'affitto
 *  aumenta a marzo, la bolletta della luce di gennaio è il doppio di quella di
 *  maggio, la fibra si disdice ad agosto. Un importo ricorrente li avrebbe
 *  riscritti all'indietro su tutti i mesi già chiusi — cioè avrebbe cambiato
 *  numeri già guardati, letti e magari già usati per decidere qualcosa.
 *  Ogni mese ha il suo elenco, e resta quello che era.
 *  Il mese nuovo NON nasce vuoto: si propongono i titoli e gli importi del mese
 *  precedente (`propostaDa`), che è il gesto che si stava cercando di
 *  risparmiare — con la differenza che si conferma, e correggere è possibile.
 *
 *  ── ⚠️ LE VOCI FISSE, E PERCHÉ SONO L'ECCEZIONE E NON LA REGOLA ───────────
 *  Richiesta del committente: certe spese non cambiano mai — l'affitto, il
 *  commercialista, l'abbonamento — e riconfermarle dodici volte l'anno è un
 *  gesto che non decide niente. Quelle si segnano `fissa`, e da lì in poi si
 *  ripresentano da sole nei mesi non ancora compilati: vedi `conLeFisse`.
 *  Le altre restano come sono sempre state — proposte con l'importo del mese
 *  prima, da confermare — perché la bolletta della luce di gennaio NON è
 *  quella di maggio, e una che si conferma da sola sarebbe un numero inventato
 *  dentro un conto vero.
 *
 *  ⚠️ E NON SI RISCRIVE NIENTE ALL'INDIETRO. Le fisse si aggiungono solo ai
 *   mesi che NON hanno un elenco scritto, e solo a quelli già cominciati: un
 *   mese salvato resta quello che era, e su un mese futuro non si inventano
 *   spese che nessuno ha ancora pagato.
 *
 *  ── DOVE VIVONO ───────────────────────────────────────────────────────────
 *  In `app_config`, chiave `costi_mese:2026-08`, attraverso lo stesso archivio
 *  delle fatture (crm/fatture/archivio): una tabella nuova su un database di
 *  produzione non si crea di iniziativa propria.
 *  ───────────────────────────────────────────────────────────────────────── */
import { archivio } from "./fatture/archivio";
import { nuovoIdVoce } from "./costi-pratica";
import type { VoceCosto } from "./types";

/** Una voce di spesa del mese. `fissa` vuol dire «questa torna uguale ogni
 *  mese, non chiedermelo più»; `automatica` — che non si salva mai, si calcola
 *  — vuol dire «questa è comparsa da sola perché era fissa, e nessuno l'ha
 *  ancora confermata per questo mese». */
export interface VoceMese extends VoceCosto {
  fissa?: boolean;
  automatica?: boolean;
}

/** Le voci proposte la prima volta che si apre un mese, nell'ordine in cui una
 *  persona le tira fuori pensandoci: prima il posto, poi le utenze, poi i
 *  servizi. Zero come importo: un numero suggerito da noi verrebbe confermato
 *  senza guardarlo, e sarebbe un costo inventato dentro un conto vero. */
export const VOCI_PREDEFINITE = [
  "Affitto",
  "Luce",
  "Acqua",
  "Gas",
  "Fibra",
  "Contabilità",
  "Abbonamenti",
  "Manutenzioni",
] as const;

/** Il mese di una data, come si scrive nella chiave: «2026-08». */
export const meseDi = (iso: string): string => String(iso ?? "").slice(0, 7);

/** Il mese di oggi. */
export const meseCorrente = (): string => new Date().toISOString().slice(0, 7);

/** Il mese prima di quello dato. «2026-01» → «2025-12». */
export function mesePrecedente(mese: string): string {
  const [a, m] = mese.split("-").map(Number);
  if (!a || !m) return mese;
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}

/** Il mese scritto come lo direbbe una persona: «agosto 2026». */
export function meseLeggibile(mese: string): string {
  const d = new Date(`${mese}-01T12:00:00`);
  return Number.isNaN(d.getTime())
    ? mese
    : d.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}

const chiave = (mese: string) => `costi_mese:${mese}`;

/** ⚠️ Letture prudenti: il valore in archivio è una stringa scritta da noi, ma
 *  una riga corrotta a mano o mezza scrittura interrotta non deve spegnere la
 *  pagina dei conti. Quello che non si capisce vale «nessun costo». */
function leggiElenco(grezzo: string | null): VoceMese[] {
  if (!grezzo) return [];
  try {
    const v = JSON.parse(grezzo);
    if (!Array.isArray(v)) return [];
    return v
      .filter((r): r is VoceMese => !!r && typeof r === "object")
      .map((r) => ({
        id: String(r.id ?? ""),
        titolo: String(r.titolo ?? "").trim(),
        importo: Number.isFinite(Number(r.importo)) ? Number(r.importo) : 0,
        ...(r.fissa === true ? { fissa: true } : {}),
      }))
      .filter((r) => r.id);
  } catch {
    return [];
  }
}

export async function leggiCostiMese(mese: string): Promise<VoceMese[]> {
  return leggiElenco(await archivio.leggi(chiave(mese)));
}

/** Tutti i mesi che hanno un elenco scritto, dal più recente. Serve alla
 *  contabilità, che somma i costi di un periodo lungo più mesi. */
export async function leggiCostiDiPiuMesi(mesi: string[]): Promise<Record<string, VoceMese[]>> {
  const righe = await archivio.leggiPrefisso("costi_mese:");
  const salvati: Record<string, VoceMese[]> = {};
  for (const r of righe) {
    salvati[r.key.replace("costi_mese:", "")] = leggiElenco(r.value);
  }
  return conLeFisse(salvati, mesi, meseCorrente());
}

/** ── ⚠️ I MESI CHE NESSUNO HA ANCORA COMPILATO ────────────────────────────
 *  Un mese senza elenco non vuol dire che l'affitto non sia stato pagato: vuol
 *  dire che nessuno si è ancora seduto a scriverlo. Le voci segnate `fissa`
 *  nell'ultimo mese compilato PRIMA di quello si ripresentano da sole, marcate
 *  `automatica` — così chi guarda sa che quel numero non l'ha confermato
 *  nessuno per quel mese.
 *
 *  ⚠️ Solo dopo l'ultimo mese compilato e non oltre il mese corrente. Prima
 *   non c'erano (inventare un affitto nel 2024 perché oggi è fisso vorrebbe
 *   dire riscrivere un conto già guardato); dopo non è ancora successo niente.
 *  ⚠️ Un mese SALVATO vince sempre, anche se è vuoto: se qualcuno ha aperto
 *   marzo e ha cancellato tutto, marzo è vuoto — non «da riempire con le
 *   fisse».
 *
 *  Pura, perché sia controllabile senza un archivio davanti. */
export function conLeFisse(
  salvati: Record<string, VoceMese[]>,
  mesi: string[],
  meseOggi: string,
): Record<string, VoceMese[]> {
  const scritti = Object.keys(salvati).sort();
  const fuori: Record<string, VoceMese[]> = {};
  for (const m of mesi) {
    if (Object.prototype.hasOwnProperty.call(salvati, m)) {
      fuori[m] = salvati[m];
      continue;
    }
    if (m > meseOggi) continue;
    //  L'ultimo mese compilato prima di questo: è lì che stanno le fisse in
    //  vigore. Se non ce n'è nessuno, questo mese resta senza niente.
    const prima = scritti.filter((k) => k < m).pop();
    if (!prima) continue;
    const fisse = salvati[prima]
      .filter((v) => v.fissa && (Number(v.importo) || 0) > 0)
      //  ⚠️ Un id nuovo per mese: gli id delle voci finiscono nelle righe del
      //   conto, e tre mesi di affitto con lo stesso id sarebbero tre righe che
      //   React considera la stessa.
      .map((v) => ({ ...v, id: `${m}:${v.id}`, automatica: true }));
    if (fisse.length > 0) fuori[m] = fisse;
  }
  return fuori;
}

/** Torna il messaggio d'errore, o null se è andata. */
export function salvaCostiMese(mese: string, voci: VoceMese[]): Promise<string | null> {
  //  ⚠️ Le righe senza titolo E senza importo si buttano: sono i «+» premuti
  //   per sbaglio, e salvate resterebbero lì per sempre a chiedersi cosa sono.
  //   Una riga con l'importo e senza titolo invece resta — quei soldi sono
  //   usciti davvero — e prende un nome che dice cos'è.
  const puliti = voci
    .filter((v) => v.titolo.trim() || (Number(v.importo) || 0) > 0)
    .map((v) => ({
      id: v.id,
      titolo: v.titolo.trim() || "Costo senza titolo",
      importo: Math.max(0, Number(v.importo) || 0),
      //  ⚠️ `automatica` NON si salva: è il modo in cui una voce è arrivata a
      //   schermo, non una sua proprietà. Salvandola, quella voce è stata
      //   confermata da una persona — e da quel momento è come tutte le altre.
      ...(v.fissa ? { fissa: true } : {}),
    }));
  return archivio.scrivi(chiave(mese), JSON.stringify(puliti));
}

/** Cosa proporre aprendo un mese: quello che c'è già, oppure il mese prima,
 *  oppure l'elenco predefinito. Gli importi del mese prima si ricopiano — è
 *  quasi sempre la stessa cifra — ma sono da confermare, non già confermati. */
export function propostaDa(precedente: VoceMese[]): VoceMese[] {
  if (precedente.length > 0) {
    //  ⚠️ `fissa` si porta dietro: è la scelta di chi l'ha messa, e ricominciare
    //   da capo ogni mese vorrebbe dire che «fissa» non vuol dire niente.
    return precedente.map((v) => ({ ...v, id: nuovoIdVoce(), automatica: undefined }));
  }
  return VOCI_PREDEFINITE.map((titolo) => ({ id: nuovoIdVoce(), titolo, importo: 0 }));
}

export const totaleVoci = (voci: VoceMese[]): number =>
  voci.reduce((s, v) => s + (Number(v.importo) || 0), 0);
