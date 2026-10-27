/** ── PRENOTA IN CHAT: GLI ORARI ────────────────────────────────────────────
 *
 *  Commessa 2026-10-27 (PIANO.md T2). Dato l'archivio delle schede, i blocchi
 *  della disponibilità e l'orologio, dice QUALI ORARI SI POSSONO PROPORRE al
 *  lead e QUALE CONSULENTE prende quello che sceglie. Puro: niente database,
 *  niente `fetch`; l'orologio entra come argomento (`adesso`).
 *
 *  Le regole (tutte dal PIANO):
 *   · D1 UNO PER ORA. Un orario si propone e si prenota solo se l'agenda lo dà
 *     `libero` (`slotDelGiorno`, stato «libero»): nessun altro lead alla stessa
 *     ora, nessun impegno che lo copra. Lo stato «insieme» non si propone mai.
 *   · D5 I blocchi della disponibilità (chiusure del centro, malattie) li
 *     applica la schermata del browser, non `slotDelGiorno`: qui si leggono
 *     con `intervalliBloccati`, sempre col «oggi» di Roma.
 *   · D6 Filippo per primo, poi gli altri per priorità, nome, id.
 *   · D7 La proposta mostrata e la verifica al tocco usano la STESSA funzione
 *     (`slotLiberiDelGiorno`): mai due fonti di verità sull'orario.
 *   · D10 Se la fascia chiesta è vuota si ripiega su un'altra; D11 «ALTRI» non
 *     ripete e preferisce i giorni mai proposti.
 *
 *  ⚠️ L'ORA È SEMPRE QUELLA DI ROMA, MAI QUELLA DEL SERVER (il Worker gira in
 *   UTC). «Oggi», le 3 ore di preavviso e la fascia si leggono con `aRoma` e
 *   `minutiAlla` di `promemoria/formati`; i giorni si contano con `Date.UTC` e
 *   si scrivono con i `getUTC*`. Niente `getHours`, `getDate`, `toLocale*`,
 *   `toISOString().slice`: la prova lo controlla leggendo questo file.
 *  ───────────────────────────────────────────────────────────────────────── */
import { intervalliBloccati, minutiDaOra } from "../blocchi";
import { slotDelGiorno } from "../booking-utils";
import { aRoma, minutiAlla } from "../promemoria/formati";
import type { Consultant } from "../types";
import {
  FASCE,
  type Fascia,
  type InputAncoraLibero,
  type InputProponi,
  type InputScegli,
  type InputSlot,
  type OraProposta,
  type Proposta,
} from "./prenota-tipi";

const due = (n: number) => String(n).padStart(2, "0");

/** I giorni civili di Roma da oggi a oggi+`giorniAvanti` (`AAAA-MM-GG`). */
export function giorniFinestra(adesso: Date, giorniAvanti: number): string[] {
  const [a, m, g] = aRoma(adesso).giorno.split("-").map(Number);
  const out: string[] = [];
  for (let k = 0; k <= giorniAvanti; k++) {
    const d = new Date(Date.UTC(a, m - 1, g + k));
    out.push(`${d.getUTCFullYear()}-${due(d.getUTCMonth() + 1)}-${due(d.getUTCDate())}`);
  }
  return out;
}

const nomeDi = (c: Consultant) =>
  String(c.data.nome ?? "")
    .trim()
    .toLowerCase();

/** Solo i consulenti attivi e approvati, nell'ordine di priorità (D6). */
export function consulentiPrenotabili(consulenti: Consultant[]): Consultant[] {
  const priorita = (c: Consultant) => (Number.isFinite(c.data.priorita) ? c.data.priorita! : 1);
  return consulenti
    .filter(
      (c) =>
        c.data.attivo !== false &&
        (c.data.approvalStatus == null || c.data.approvalStatus === "approved"),
    )
    .sort(
      (a, b) =>
        priorita(a) - priorita(b) ||
        // shortcut: confronto per codice, non per lingua (`localeCompare` cambia da
        // server a server); i nomi accentati finiscono in fondo, basta che l'ordine
        // sia sempre lo stesso. Da cambiare se serve un alfabeto vero.
        (nomeDi(a) < nomeDi(b) ? -1 : nomeDi(a) > nomeDi(b) ? 1 : 0) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
}

/** Le ore (`HH:MM`) in cui UN consulente è `libero` quel giorno (D1). */
export function slotLiberiDelGiorno(i: InputSlot): string[] {
  const oggi = i.oggiRoma ?? aRoma(i.adesso).giorno;
  const chiusi = intervalliBloccati(i.blocchi, i.consulente.id, i.giorno, oggi);
  return (
    //  ⚠️ Senza `modi` (rev. 3): con «uno per ora» non cambiano la risposta.
    slotDelGiorno(i.consulente, i.giorno, i.durata, i.schede, i.escludiLeadId)
      .filter((s) => s.stato === "libero")
      .filter((s) => minutiAlla(i.giorno, s.ora, i.adesso) >= i.preavvisoOre * 60)
      .filter((s) => {
        const da = minutiDaOra(s.ora);
        return da !== null && !chiusi.some((b) => da < b.fine && da + i.durata > b.inizio);
      })
      .map((s) => s.ora)
  );
}

/** In che ordine si prova un'altra fascia quando quella chiesta è vuota (D10). */
const RIPIEGO: Record<Fascia, Fascia[]> = {
  sera: ["pomeriggio", "mattina"],
  mattina: ["pomeriggio", "sera"],
  pomeriggio: ["sera", "mattina"],
};

const inFascia = (f: Fascia, ora: string) => {
  const m = minutiDaOra(ora);
  return m !== null && m >= FASCE[f].da && m <= FASCE[f].a;
};

const chiave = (p: OraProposta) => `${p.g} ${p.o}`;
const inOrdine = (a: OraProposta, b: OraProposta) =>
  a.g < b.g ? -1 : a.g > b.g ? 1 : a.o < b.o ? -1 : a.o > b.o ? 1 : 0;

export function proponi(i: InputProponi): Proposta {
  const consulenti = consulentiPrenotabili(i.consulenti);
  const oggiRoma = aRoma(i.adesso).giorno;

  //  Per ogni giorno, le ore in cui ALMENO UN consulente è libero (unione per
  //  giorno+ora, senza dire chi: il consulente si sceglie al tocco, D6).
  const perGiorno = giorniFinestra(i.adesso, i.giorniAvanti).map((g) => {
    const ore = new Set<string>();
    for (const consulente of consulenti)
      for (const o of slotLiberiDelGiorno({
        consulente,
        giorno: g,
        oggiRoma,
        durata: i.durata,
        schede: i.schede,
        blocchi: i.blocchi,
        adesso: i.adesso,
        preavvisoOre: i.preavvisoOre,
      }))
        ore.add(o);
    return { g, ore: [...ore].sort() };
  });

  const visti = new Set(i.mostrati.map(chiave));
  const giorniVisti = new Set(i.mostrati.map((m) => m.g));
  /** i giorni con almeno un orario di quella fascia; `nuovi` = non ancora mostrati */
  const candidati = (f: Fascia, nuovi: boolean) =>
    perGiorno
      .map(({ g, ore }) => ({
        g,
        ore: ore.filter((o) => inFascia(f, o) && !(nuovi && visti.has(`${g} ${o}`))),
      }))
      .filter((d) => d.ore.length > 0);

  //  D10: si ripiega solo se la fascia chiesta è vuota IN ASSOLUTO. Se ha orari
  //  ma li abbiamo già mostrati tutti, è «finiti»: non si cambia fascia a metà
  //  di «ALTRI».
  let fascia = i.fascia;
  let ripiego = false;
  if (candidati(i.fascia, false).length === 0) {
    const altra = RIPIEGO[i.fascia].find((f) => candidati(f, true).length > 0);
    if (altra) {
      fascia = altra;
      ripiego = true;
    }
  }

  //  D11: prima i giorni mai proposti (data crescente), poi quelli già proposti;
  //  un orario per giorno (il primo libero), su 3 giorni diversi.
  const nuovi = candidati(fascia, true);
  const giorni = [
    ...nuovi.filter((d) => !giorniVisti.has(d.g)),
    ...nuovi.filter((d) => giorniVisti.has(d.g)),
  ].slice(0, 3);
  const proposte = giorni.map((d) => ({ g: d.g, o: d.ore[0] }));
  //  Meno di 3 giorni: si completa con altri orari degli stessi giorni.
  for (let k = 1; proposte.length < 3 && giorni.some((d) => d.ore[k]); k++)
    for (const d of giorni)
      if (proposte.length < 3 && d.ore[k]) proposte.push({ g: d.g, o: d.ore[k] });

  proposte.sort(inOrdine);
  return { proposte, fasciaEffettiva: fascia, ripiego, finiti: proposte.length === 0 };
}

/** Il consulente per quello slot (Filippo, poi il primo libero), o `null`. */
export function scegliConsulente(i: InputScegli): Consultant | null {
  const prenotabili = consulentiPrenotabili(i.consulenti);
  //  D6: il preferito è `config.consulenteId` se c'è; altrimenti l'UNICO
  //  consulente con nome di battesimo «filippo». Con 0 o 2 Filippo, o col
  //  preferito non prenotabile, nessuna preferenza: vale l'ordine di priorità.
  const id = i.preferito.trim();
  const filippo = prenotabili.filter((c) => nomeDi(c).split(/\s+/)[0] === "filippo");
  const preferito = id
    ? prenotabili.find((c) => c.id === id)
    : filippo.length === 1
      ? filippo[0]
      : undefined;
  const ordine = preferito
    ? [preferito, ...prenotabili.filter((c) => c !== preferito)]
    : prenotabili;
  return (
    ordine.find((consulente) =>
      ancoraLibero({
        consulente,
        giorno: i.giorno,
        ora: i.ora,
        durata: i.durata,
        schede: i.schede,
        blocchi: i.blocchi,
        adesso: i.adesso,
        preavvisoOre: i.preavvisoOre,
        escludiLeadId: i.escludiLeadId,
      }),
    ) ?? null
  );
}

/** Lo slot è ancora libero per quel consulente? (dentro il lucchetto e dopo la scrittura) */
export function ancoraLibero(i: InputAncoraLibero): boolean {
  return slotLiberiDelGiorno(i).includes(i.ora);
}
