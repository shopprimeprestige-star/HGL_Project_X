/** ── IL SECONDO STATO: «STATO DEL CONTATTO» ─────────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat). Sta ACCANTO allo stato di
 *  sempre del lead e non lo tocca mai: «Ricontatto fissato» e «Contattato»
 *  convivono. Si salva nel JSON della scheda, `data.contattoWa`, senza colonne
 *  nuove. Questo modulo è PURO: niente rete, niente database, niente orologio
 *  (`adesso` arriva sempre dal chiamante) e quindi tutto provato in
 *  `prove/manychat/contatto.mjs`.
 *
 *  ── LE REGOLE DI PASSAGGIO (SPEC §4) ──────────────────────────────────────
 *   1. un invio accettato da ManyChat → «In attesa», con `scadeRisposta`:
 *        ricontatto  24 ore dopo, ma di domenica si slitta al lunedì alla
 *                    stessa ora (l'ora è quella di Roma, anche a cavallo del
 *                    cambio dell'ora);
 *        promemoria  l'inizio del meet.
 *   2. una risposta → «Ha risposto», con l'anteprima (al massimo 80 caratteri)
 *      nella storia;
 *   3. «In attesa» con la scadenza passata → «Non ha risposto». Lo CALCOLA
 *      `statoContattoEffettivo`, che usano tutte le schermate e i filtri: nessun
 *      giro deve girare perché la pastiglia sia giusta. La storia lo scrive al
 *      giro dopo (`dopoScadenza`);
 *   4. STOP / basta / «non scrivete più» / «cancellatemi» → «Non scrivere»;
 *   5. rifiuto (numero non su WhatsApp, contatto non creabile, modello
 *      rifiutato) → «Non raggiungibile», col motivo;
 *   6. un cambio a mano vale sempre ed entra nella storia col nome di chi l'ha
 *      fatto. Mettere a mano «Contattato», «Ha risposto» o «Da ricontattare»
 *      SBLOCCA il freno «mai due volte senza risposta» (`sbloccatoIl`);
 *   7. cambiare lo stato di sempre non cambia questo, e viceversa.
 *
 *  ⚠️ STOP È APPICCICOSO. Nessun automatismo lo toglie: né un nuovo invio, né
 *   una risposta qualunque, né un rifiuto, né la scadenza. Lo mette chiunque
 *   (a mano), lo toglie solo chi ha il permesso «impostazioni», e allora si
 *   azzera anche `whatsapp_contacts.non_scrivere_dal` (lo fa la rotta, qui si
 *   dice solo `togliStop`).
 *  ⚠️ Le funzioni `dopo…` e `cambioAMano` NON scrivono: restituiscono il
 *   cambio (`CambioContatto`) che il server passa alla funzione SQL
 *   `contatto_wa_aggiorna(patch, voce)`. `applicaCambio` fa in TypeScript la
 *   stessa fusione dell'SQL (voce nuova in testa, al massimo 20): serve alle
 *   prove e a chi vuole mostrare il risultato prima della risposta del server.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { ContattoWa, LeadData, StatoContattoWa, VoceContattoWa } from "../types";
import { aRoma, oraNormale } from "../promemoria/formati";
import { leggiRisposta } from "../promemoria/risposta";

export type StatoContatto = StatoContattoWa;
export type { ContattoWa, VoceContattoWa };

/** In che ordine si propongono. */
export const STATI_CONTATTO: StatoContatto[] = [
  "contattato",
  "in_attesa",
  "ha_risposto",
  "non_ha_risposto",
  "da_ricontattare",
  "stop",
  "non_raggiungibile",
];

export const ETICHETTE_CONTATTO: Record<StatoContatto, string> = {
  contattato: "Contattato",
  in_attesa: "In attesa",
  ha_risposto: "Ha risposto",
  non_ha_risposto: "Non ha risposto",
  da_ricontattare: "Da ricontattare",
  stop: "Non scrivere (STOP)",
  non_raggiungibile: "Non raggiungibile",
};

/** Il «colore» in parole: la schermata lo traduce in classi. Il colore da solo
 *  non basta mai (c'è sempre l'etichetta). */
export type ToneContatto = "neutro" | "info" | "ok" | "attenzione" | "stop";

export const TONI_CONTATTO: Record<StatoContatto, ToneContatto> = {
  contattato: "neutro",
  in_attesa: "info",
  ha_risposto: "ok",
  non_ha_risposto: "attenzione",
  da_ricontattare: "attenzione",
  stop: "stop",
  non_raggiungibile: "stop",
};

/** Le voci di storia che si tengono. */
export const MAX_STORIA = 20;
/** Le lettere dell'anteprima della risposta. */
export const ANTEPRIMA_MAX = 80;
/** Chi firma i cambi che fa il sistema. */
export const DA_AUTOMATICO = "automatico";

export const FRASE_STOP_RISERVATO =
  "Solo chi ha il permesso «impostazioni» può togliere il blocco STOP.";

/** Quello che cambia nel secondo stato. `stato`, `il` e `da` sostituiscono i
 *  vecchi; `motivo` e `scadeRisposta` pure (se mancano, si tolgono);
 *  `invioId` e `sbloccatoIl` restano quelli di prima se il cambio non ne porta
 *  uno. È la stessa regola della funzione SQL. */
export interface CambioContatto {
  patch: Omit<ContattoWa, "storia">;
  voce: VoceContattoWa;
}

/** ── L'ORA DI ROMA → UN ISTANTE ──────────────────────────────────────────
 *  «2026-10-20» + «15:30» → l'istante giusto, ora legale o solare che sia.
 *  `null` se il giorno o l'ora non sono veri.
 *  Un'ora che a Roma esiste due volte (la notte del cambio d'ottobre) vale la
 *  prima; una che non esiste (il salto di marzo) vale la prima ora dopo il
 *  salto. */
export function istanteDiRoma(giorno: string, ora: string): Date | null {
  const g = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(giorno ?? ""));
  const hm = oraNormale(ora);
  if (!g || !hm) return null;
  const [a, me, d] = [Number(g[1]), Number(g[2]), Number(g[3])];
  const [h, mi] = hm.split(":").map(Number);
  const chiaro = new Date(Date.UTC(a, me - 1, d));
  if (chiaro.getUTCFullYear() !== a || chiaro.getUTCMonth() !== me - 1 || chiaro.getUTCDate() !== d)
    return null;
  const comeSeFosseUtc = Date.UTC(a, me - 1, d, h, mi);
  //  Roma è avanti di 2 ore (legale) o di 1 (solare): si prova prima l'una,
  //  poi l'altra, e vale quella per cui l'orologio di Roma segna l'ora chiesta.
  for (const scarto of [2, 1]) {
    const t = new Date(comeSeFosseUtc - scarto * 3_600_000);
    const r = aRoma(t);
    if (r.giorno === giorno && r.minuti === h * 60 + mi) return t;
  }
  return new Date(comeSeFosseUtc - 3_600_000);
}

const dueCifre = (n: number) => String(n).padStart(2, "0");

/** Il giorno dopo («AAAA-MM-GG»), sul calendario. */
function giornoDopo(giorno: string): string {
  const [a, m, d] = giorno.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Quando scade l'attesa di un ricontatto: lo stesso orario di Roma del giorno
 *  dopo, e se quel giorno è domenica, del lunedì. Si conta sul calendario di
 *  Roma e non in 24 ore secche: a cavallo del cambio dell'ora «sabato 11:00»
 *  deve restare «lunedì 11:00». */
export function scadenzaRicontatto(inviatoIl: Date): Date {
  const r = aRoma(inviatoIl);
  let giorno = giornoDopo(r.giorno);
  if (new Date(`${giorno}T00:00:00Z`).getUTCDay() === 0) giorno = giornoDopo(giorno);
  const t = istanteDiRoma(
    giorno,
    `${dueCifre(Math.floor(r.minuti / 60))}:${dueCifre(r.minuti % 60)}`,
  );
  //  `istanteDiRoma` non sbaglia con un giorno e un'ora costruiti qui; i
  //  secondi dell'invio si conservano.
  const secondi = ((inviatoIl.getTime() % 60_000) + 60_000) % 60_000;
  return new Date((t as Date).getTime() + secondi);
}

const isoDi = (d: Date) => d.toISOString();

/** Il tempo dell'attesa è finito? (una scadenza illeggibile non scade mai) */
function scaduta(c: ContattoWa, adesso: Date): boolean {
  if (c.stato !== "in_attesa" || !c.scadeRisposta) return false;
  return Date.parse(c.scadeRisposta) <= adesso.getTime();
}

/** Lo stato che si mostra: quello salvato, tranne «In attesa» a scadenza
 *  passata, che è «Non ha risposto». `null` se la scheda non ne ha. */
export function statoContattoEffettivo(
  d: Pick<Partial<LeadData>, "contattoWa"> | null | undefined,
  adesso: Date,
): StatoContatto | null {
  const c = d?.contattoWa;
  if (!c?.stato) return null;
  return scaduta(c, adesso) ? "non_ha_risposto" : c.stato;
}

/** Costruisce un cambio: la voce di storia ricalca la patch. */
function cambio(
  patch: Omit<ContattoWa, "storia">,
  extra: Pick<VoceContattoWa, "anteprima"> = {},
): CambioContatto {
  const voce: VoceContattoWa = { stato: patch.stato, il: patch.il, da: patch.da };
  if (patch.motivo !== undefined) voce.motivo = patch.motivo;
  if (extra.anteprima) voce.anteprima = extra.anteprima;
  return { patch, voce };
}

/** Il secondo stato dopo il cambio: la fusione che fa anche l'SQL. */
export function applicaCambio(prima: ContattoWa | undefined | null, c: CambioContatto): ContattoWa {
  const p = c.patch;
  const nuovo: ContattoWa = {
    stato: p.stato,
    il: p.il,
    da: p.da,
    storia: [c.voce, ...(prima?.storia ?? [])].slice(0, MAX_STORIA),
  };
  if (p.motivo !== undefined) nuovo.motivo = p.motivo;
  if (p.scadeRisposta !== undefined) nuovo.scadeRisposta = p.scadeRisposta;
  const invioId = p.invioId ?? prima?.invioId;
  if (invioId !== undefined) nuovo.invioId = invioId;
  const sbloccatoIl = p.sbloccatoIl ?? prima?.sbloccatoIl;
  if (sbloccatoIl !== undefined) nuovo.sbloccatoIl = sbloccatoIl;
  return nuovo;
}

const eStopAppiccicoso = (prima: ContattoWa | undefined | null) => prima?.stato === "stop";

export type IngressoInvio =
  | { tipo: "ricontatto"; inviatoIl: Date; invioId: string }
  | { tipo: "promemoria"; inviatoIl: Date; inizioMeet: Date; invioId: string };

/** ManyChat ha accettato un invio → «In attesa» con la sua scadenza. `null` se
 *  la scheda è in STOP (non si toglie da sola). */
export function dopoInvio(
  prima: ContattoWa | undefined | null,
  i: IngressoInvio,
): CambioContatto | null {
  if (eStopAppiccicoso(prima)) return null;
  const scade = i.tipo === "ricontatto" ? scadenzaRicontatto(i.inviatoIl) : i.inizioMeet;
  //  ⚠️ `invioId` è obbligatorio: `applicaCambio` conserva quello vecchio se
  //   il cambio non ne porta uno, e `p_se_invio` confronterebbe le risposte con
  //   l'invio sbagliato. Il giro l'id lo ha sempre, dalla prenotazione.
  const patch: Omit<ContattoWa, "storia"> = {
    stato: "in_attesa",
    il: isoDi(i.inviatoIl),
    da: DA_AUTOMATICO,
    motivo: i.tipo,
    scadeRisposta: isoDi(scade),
    invioId: i.invioId,
  };
  return cambio(patch);
}

/** Le parole di chi non vuole più messaggi, oltre a quelle del 22/10 («stop»,
 *  «basta»). Scritte NORMALIZZATE (senza accenti, minuscole, spazi singoli) e
 *  cercate come parole intere. Prudente per scelta: un falso STOP è una
 *  telefonata in più, un STOP perso è un cliente che si lamenta. */
const FRASI_STOP = [
  "non scrivete piu",
  "non scrivetemi piu",
  "non scrivermi piu",
  "non mi scrivete piu",
  "non mi scrivere piu",
  "non mi scrivi piu",
  "non mi contattate piu",
  "non mi contattare piu",
  "non mi mandate piu",
  "non voglio piu messaggi",
  "toglietemi",
  "non mandatemi piu",
  "non mandate piu",
  "non contattatemi",
  "cancellatemi",
  "cancellami",
  "cancellarmi",
  "disiscrivetemi",
  "disiscrivimi",
];

const normalizza = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Il testo è una richiesta di non ricevere più messaggi? */
export function eStop(testo: string | null | undefined): boolean {
  const t = String(testo ?? "");
  if (leggiRisposta(t) === "stop") return true;
  const n = ` ${normalizza(t)} `;
  return FRASI_STOP.some((f) => n.includes(` ${f} `));
}

/** L'inizio del testo, al massimo `ANTEPRIMA_MAX` unità, senza spezzare un
 *  carattere (nemmeno un'emoji composta: 👨‍👩‍👧 resta intera o non c'è) e con gli
 *  a-capo ridotti a uno spazio. */
function anteprimaDi(testo: string | null | undefined): string {
  const t = String(testo ?? "")
    .replace(/\s+/g, " ")
    .trim();
  let fuori = "";
  for (const { segment } of new Intl.Segmenter("it", { granularity: "grapheme" }).segment(t)) {
    if (fuori.length + segment.length > ANTEPRIMA_MAX) break;
    fuori += segment;
  }
  return fuori;
}

/** Il cliente ha scritto → «Ha risposto» (con l'anteprima), oppure «Non
 *  scrivere» se è uno STOP. `null` se la scheda è già in STOP. */
export function dopoRisposta(
  prima: ContattoWa | undefined | null,
  testo: string | null | undefined,
  il: Date,
): CambioContatto | null {
  if (eStopAppiccicoso(prima)) return null;
  if (eStop(testo))
    return cambio({ stato: "stop", il: isoDi(il), da: DA_AUTOMATICO, motivo: "stop" });
  return cambio(
    { stato: "ha_risposto", il: isoDi(il), da: DA_AUTOMATICO },
    { anteprima: anteprimaDi(testo) },
  );
}

/** Invio rifiutato (numero non su WhatsApp, contatto non creabile, modello
 *  rifiutato) → «Non raggiungibile» col motivo. `null` se la scheda è in STOP. */
export function dopoRifiuto(
  prima: ContattoWa | undefined | null,
  motivo: string,
  il: Date,
): CambioContatto | null {
  if (eStopAppiccicoso(prima)) return null;
  return cambio({ stato: "non_raggiungibile", il: isoDi(il), da: DA_AUTOMATICO, motivo });
}

/** Il giro scrive nella storia che il tempo è scaduto. `il` è l'istante della
 *  scadenza (non quello del giro). `null` se non c'è niente da registrare. */
export function dopoScadenza(
  prima: ContattoWa | undefined | null,
  adesso: Date,
): CambioContatto | null {
  if (!prima || eStopAppiccicoso(prima) || !scaduta(prima, adesso)) return null;
  const patch: Omit<ContattoWa, "storia"> = {
    stato: "non_ha_risposto",
    il: isoDi(new Date(Date.parse(prima.scadeRisposta as string))),
    da: DA_AUTOMATICO,
  };
  if (prima.motivo !== undefined) patch.motivo = prima.motivo;
  return cambio(patch);
}

/** Questi tre, messi a mano, sbloccano il freno «mai due volte senza risposta». */
const SBLOCCANO: StatoContatto[] = ["contattato", "ha_risposto", "da_ricontattare"];

export type EsitoCambioAMano =
  | {
      ok: true;
      cambio: CambioContatto;
      /** vero se si mette STOP: va scritto anche `whatsapp_contacts.non_scrivere_dal` */
      mettiStop: boolean;
      /** vero se si toglie STOP: `non_scrivere_dal` va azzerato */
      togliStop: boolean;
    }
  | { ok: false; errore: "solo_titolare_toglie_stop"; messaggio: string };

/** Un cambio fatto da una persona. Vale sempre, tranne togliere STOP senza il
 *  permesso «impostazioni». */
export function cambioAMano(
  prima: ContattoWa | undefined | null,
  nuovo: StatoContatto,
  chi: string,
  il: Date,
  puoTogliereStop: boolean,
): EsitoCambioAMano {
  const togliStop = eStopAppiccicoso(prima) && nuovo !== "stop";
  if (togliStop && !puoTogliereStop) {
    return { ok: false, errore: "solo_titolare_toglie_stop", messaggio: FRASE_STOP_RISERVATO };
  }
  const patch: Omit<ContattoWa, "storia"> = {
    stato: nuovo,
    il: isoDi(il),
    da: chi.trim() || "sconosciuto",
  };
  if (togliStop || SBLOCCANO.includes(nuovo)) patch.sbloccatoIl = isoDi(il);
  return { ok: true, cambio: cambio(patch), mettiStop: nuovo === "stop", togliStop };
}

/** Il filtro delle liste: uno dei sette stati (quello che si VEDE, cioè con la
 *  scadenza calcolata), «nessuno» (scheda senza secondo stato) o «tutti». Un
 *  valore che non si riconosce non filtra niente. */
export type FiltroContatto = StatoContatto | "nessuno" | "tutti";

export function filtraPerContatto<T extends { data?: Partial<LeadData> | null }>(
  schede: T[],
  filtro: FiltroContatto | string,
  adesso: Date,
): T[] {
  if (filtro === "nessuno") return schede.filter((s) => !statoContattoEffettivo(s.data, adesso));
  if (!(STATI_CONTATTO as string[]).includes(filtro)) return schede;
  return schede.filter((s) => statoContattoEffettivo(s.data, adesso) === filtro);
}
