/** ── DI CHI È UNA COSA DA FARE ─────────────────────────────────────────────
 *
 *  DA DOVE ARRIVA
 *  Segnalazione del committente: «da fare oggi, nella scheda ci sia filtro per
 *  setter e per consulenti — correggi perché ora mette tutto insieme».
 *  Il filtro c'era, ma solo in una delle due schermate che mostrano la stessa
 *  giornata (/CRM/dafare sì, la linguetta «Oggi» dei lead importati no), e
 *  soprattutto non teneva conto di TUTTI: chi sulla sua scheda non ha spuntato
 *  né setter né consulente non entrava in nessuno dei due mucchi e non aveva
 *  nemmeno una tessera sua. Le sue cose da fare si potevano vedere soltanto
 *  dentro il mucchio di tutti — che è, alla lettera, «tutto insieme».
 *
 *  PERCHÉ È UN FILE A PARTE, E PURO
 *  Perché adesso la stessa domanda se la fanno due schermate, e due risposte
 *  scritte in due punti diversi sono due filtri che col tempo contano cose
 *  diverse. Qui non c'è nessuna JSX e nessuna chiamata di rete: si può provare
 *  (vedi proveDiChi) senza tirarsi dietro React.
 *
 *  ⚠️ L'APPARTENENZA È IL CONSULENTE ASSEGNATO ALLA SCHEDA, non chi ha
 *   impostato la cosa da fare: il CRM salva UN SOLO nome per scheda
 *   (`consulenteId`), quello di chi farà la consulenza. È il criterio più
 *   onesto che i dati permettano, e le schermate lo scrivono a chi guarda
 *   invece di lasciarglielo dedurre da un conteggio che non torna.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { Consultant } from "@/crm/types";
//  I mestieri si leggono da un posto solo: sono spunte sulla scheda del
//  collaboratore, e `mestieriDi` è la funzione che le interpreta — comprese le
//  esportazioni che scrivono i booleani come "1" e "0".
import { mestieriDi } from "@/crm/kpi-setter";
import type { RigaDaFare } from "./righe";
import { padroneDelTask } from "./task-manuali";

/** Che mestiere fa una persona, come lo sa questa pagina. */
export interface MestiereDiUno {
  nome: string;
  setter: boolean;
  consulente: boolean;
  /** ── ⚠️ QUALCUNO L'HA DETTO, O LO STIAMO INDOVINANDO? ─────────────────
   *  Su una scheda in cui nessuno ha spuntato niente, `mestieriDi` risponde
   *  «consulente» perché deve rispondere qualcosa. Tenere insieme il ripiego e
   *  la scelta vorrebbe dire un filtro «Consulenti» pieno di gente di cui non
   *  si sa cosa faccia — e un filtro che afferma una cosa che nessuno ha mai
   *  detto è peggio di un filtro che non c'è. */
  dichiarato: boolean;
}

export type MappaMestieri = Map<string, MestiereDiUno>;

/** I valori speciali del filtro. Sono stringhe perché convivono nello stesso
 *  campo con gli id delle persone: una sola variabile, un solo confronto. */
export const CHI_TUTTI = "";
export const CHI_SETTER = "ruolo:setter";
export const CHI_CONSULENTE = "ruolo:consulente";
export const CHI_SENZA_MESTIERE = "ruolo:senza";
export const CHI_NESSUNO = "nessuno";

/** Di chi è questa riga: il consulente assegnato alla scheda, oppure — per le
 *  cose scritte a mano, che una scheda non ce l'hanno — chi l'ha scritta.
 *  Stringa vuota = di nessuno, ed è una risposta legittima (una scheda può non
 *  essere assegnata). */
export function rigaDiChi(r: RigaDaFare): string {
  return String(r.lead?.data?.consulenteId ?? (r.task ? padroneDelTask(r.task) : "") ?? "").trim();
}

/** Il mestiere è dichiarato E dice qualcosa? Un `dichiarato` con tutti e due i
 *  mestieri spenti è una scheda che dice «non fa né l'uno né l'altro»: per
 *  questo filtro vale esattamente come una scheda mai compilata. */
const sapputo = (m?: MestiereDiUno): boolean => !!m?.dichiarato && (m.setter || m.consulente);

/** La riga passa il filtro scelto? */
export function rigaPassaChi(r: RigaDaFare, chi: string, mestieri: MappaMestieri): boolean {
  if (!chi) return true;
  const id = rigaDiChi(r);
  if (chi === CHI_NESSUNO) return !id;
  if (!id) return false;
  const m = mestieri.get(id);
  if (chi === CHI_SETTER) return sapputo(m) && !!m?.setter;
  if (chi === CHI_CONSULENTE) return sapputo(m) && !!m?.consulente;
  if (chi === CHI_SENZA_MESTIERE) return !sapputo(m);
  return id === chi;
}

export interface ConteggiDiChi {
  /** quante per ogni persona, per id */
  perPersona: Map<string, number>;
  setter: number;
  consulente: number;
  /** Assegnate a qualcuno che non ha un mestiere spuntato sulla scheda. */
  senzaMestiere: number;
  /** Schede che non sono di nessuno. */
  nessuno: number;
  tutte: number;
}

/** ── QUANTE NE HA CIASCUNO ─────────────────────────────────────────────────
 *  Il numero su ogni tessera del filtro.
 *  ⚠️ Chi chiama passa le righe GIÀ PASSATE dagli altri filtri ma NON da
 *   questo: il numero accanto a una scelta deve dire quante righe si
 *   otterrebbero premendola, e con il filtro già applicato direbbe sempre
 *   «tutte» o «zero».
 *  ⚠️ Chi fa tutti e due i mestieri conta in tutti e due i gruppi, quindi i
 *   numeri non si sommano al totale. È giusto così: «Setter» risponde a
 *   «quanto lavoro c'è sui contatti dei setter», non a una spartizione.
 *   Nessuna riga però resta fuori da TUTTE le caselle — è quello che rende i
 *   conti verificabili a occhio. */
export function contaDiChi(righe: RigaDaFare[], mestieri: MappaMestieri): ConteggiDiChi {
  const perPersona = new Map<string, number>();
  let setter = 0;
  let consulente = 0;
  let senzaMestiere = 0;
  let nessuno = 0;
  let tutte = 0;
  for (const r of righe) {
    tutte += 1;
    const id = rigaDiChi(r);
    if (!id) {
      nessuno += 1;
      continue;
    }
    perPersona.set(id, (perPersona.get(id) ?? 0) + 1);
    const m = mestieri.get(id);
    if (!sapputo(m)) {
      senzaMestiere += 1;
      continue;
    }
    if (m?.setter) setter += 1;
    if (m?.consulente) consulente += 1;
  }
  return { perPersona, setter, consulente, senzaMestiere, nessuno, tutte };
}

/** L'elenco delle persone da mostrare nel filtro, in ordine alfabetico.
 *  ⚠️ CI SONO TUTTI, anche chi non ha un mestiere spuntato: scartarli sembrava
 *   una pulizia ed era la causa della segnalazione — una persona che lavora
 *   davvero, ma la cui scheda non dice che mestiere fa, non aveva nessun modo
 *   di essere isolata. Una tessera a zero si spegne da sola e non dà fastidio;
 *   una persona che manca dall'elenco non si può cercare. */
export function personeDelFiltro(
  mestieri: MappaMestieri,
): { id: string; nome: string; setter: boolean; consulente: boolean; dichiarato: boolean }[] {
  return [...mestieri.entries()]
    .map(([id, m]) => ({ id, ...m }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}

/** La mappa «chi fa che mestiere», costruita una volta sola dalle schede dei
 *  collaboratori. La stessa persona può essere tutt'e due: chi fissa gli
 *  appuntamenti la mattina e fa le consulenze il pomeriggio deve comparire in
 *  tutti e due gli elenchi, non in uno scelto da noi. */
export function mappaMestieri(consultants: Consultant[]): MappaMestieri {
  const m: MappaMestieri = new Map();
  for (const c of consultants) {
    const k = mestieriDi(c.data);
    m.set(c.id, {
      nome: String(c.data?.nome ?? "").trim() || "Senza nome",
      setter: !!k.faSetter,
      consulente: !!k.faConsulente,
      dichiarato: !!k.dichiarato,
    });
  }
  return m;
}
