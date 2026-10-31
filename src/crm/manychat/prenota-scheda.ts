/** ── PRENOTA IN CHAT: LA SCHEDA ────────────────────────────────────────────
 *
 *  Commessa 2026-10-27 (PIANO.md, compito T4). Funzioni PURE sulla scheda
 *  (`LeadData`): niente database, niente orologio (entra `adesso`), niente
 *  rete. Prove in `prove/manychat/prenota-scheda.mjs`.
 *
 *  Chi può prenotare, che cosa scrive una prenotazione fatta dal cliente in
 *  chat, come si disfa se la verifica dopo la scrittura non torna.
 *
 *  ⚠️ `daPrenotare` RIFÀ QUELLO CHE FA `updateLead` DEL BROWSER (CRMContext)
 *   per questo salvataggio, con le stesse funzioni (`conStatoDal`,
 *   `patchChiFissa`, `patchAzzeraChiamate`): se la setter fissasse la stessa consulenza dal CRM,
 *   la scheda risulterebbe uguale, più due cose sole che il browser non fa:
 *   il marcatore `prenotatoChat` e la riga in nota. Il browser scrive anche
 *   altro che qui NON si scrive, ciascuno con la sua ragione (la prova li
 *   elenca): `statoDa` (ci mette l'id di chi lavora, qui non c'è nessuno),
 *   `ciRicontattaDettoIl`, `convertedAt`, `adsPurchaseIl` (non è una vendita),
 *   `contattoWa` (lo scrive solo il server con la sua funzione SQL), il
 *   biglietto di anteprima del link (non replicabile dal server, SPEC 8).
 *   `applyAutoStatus` non si chiama: su una scheda prenotabile (nessun acconto,
 *   nessuna spedizione, mai «perdi tempo») non cambia niente, e la prova lo
 *   verifica; chiamarla riscriverebbe `payment` senza motivo.
 *  ⚠️ `dataRicontatto`/`oraRicontatto` NON si toccano: il browser non le
 *   cancella passando ad «Appuntamento fissato» (la prova lo legge dal sorgente
 *   di `updateLead`), e la data di richiamo di «Da ricontattare» e simili sta
 *   lì, non in `dataMeeting`.
 *  ───────────────────────────────────────────────────────────────────────── */
import { tieneLoSlot } from "../booking-utils";
import { patchChiFissa } from "../chi-ha-fissato";
import { patchAzzeraChiamate } from "../chiamate";
import { aRoma, minutiAlla, oraNormale } from "../promemoria/formati";
import { conStatoDal } from "../stato-dal";
import { eChiusuraVinta } from "../types";
import type { LeadData } from "../types";
import { DA_AUTOMATICO, type CambioContatto } from "./contatto";
import {
  FISSATO_DA_CHAT,
  type DatiPrenotazione,
  type EsitoPrenotabile,
  type MotivoContatto,
  type PrenotatoChat,
} from "./prenota-tipi";

/** La scheda com'è davvero: `prenotatoChat` è un campo libero del JSON, non è
 *  in `LeadData` (che non si tocca, PIANO D8). */
type SchedaChat = LeadData & { prenotatoChat?: PrenotatoChat };

/** Gli stati da cui il cliente può prenotare. ⚠️ LISTA CHIUSA (fail-closed):
 *  uno stato che non è qui, anche mai visto, non prenota. Sono 12; i nomi sono
 *  quelli di `LeadStatus`. «Sta valutando» è fuori apposta (D15): ha già fatto
 *  la consulenza e ha un preventivo, lo gestisce il consulente. */
const STATI_PRENOTABILI: string[] = [
  "da_contattare",
  "non_risponde",
  "segreteria",
  "attesa_whatsapp",
  "da_chiamare",
  "richiamo",
  "ci_ricontatta_lui",
  "da_ricontattare",
  "gestire_in_chat",
  "fissa_meet_dopo",
  "no_show",
  "non_fatto",
  "da_spostare",
];

/** La storia è finita (o la persona non c'è più): nessun messaggio, la risposta
 *  va alla setter. Solo valori che esistono in `LeadStatus`. */
const STATI_CHIUSI: string[] = ["annullato", "perdi_tempo", "concluso", "ripensamento"];

const testo = (v: unknown): string => String(v ?? "").trim();

/** Chi può prenotare. In ordine: già cliente, storia chiusa, appuntamento in
 *  arrivo, stato non ammesso. Il nome e il numero non sono condizioni (D13: il
 *  link sta sempre nel messaggio di conferma). */
export function puoPrenotare(d: LeadData, adesso: Date): EsitoPrenotabile {
  if (eChiusuraVinta(d.stato) || (Number(d.payment?.accontoPagato) || 0) > 0)
    return { ok: false, motivo: "cliente" };
  if (STATI_CHIUSI.includes(testo(d.stato))) return { ok: false, motivo: "chiuso" };
  if (appuntamentoFuturo(d, adesso)) return { ok: false, motivo: "futuro" };
  if (!STATI_PRENOTABILI.includes(testo(d.stato))) return { ok: false, motivo: "stato" };
  return { ok: true };
}

/** La scheda tiene lo slot e `dataMeeting`+`oraMeeting` è dopo adesso (Roma).
 *  Vale a prescindere dallo stato; gli stati che liberano lo slot ricordano una
 *  data vecchia, che non è un impegno (`tieneLoSlot`). */
export function appuntamentoFuturo(d: LeadData, adesso: Date): boolean {
  if (!tieneLoSlot(d.stato)) return false;
  const giorno = testo(d.dataMeeting);
  const ora = oraNormale(d.oraMeeting);
  if (!giorno || !ora) return false;
  return minutiAlla(giorno, ora, adesso) > 0;
}

/** L'ora come si confronta: `9:00` e `09:00` sono la stessa. */
const oraDi = (v: unknown): string => oraNormale(testo(v)) ?? testo(v);

/** `prenotatoChat` presente e `g`/`o` uguali a `dataMeeting`/`oraMeeting`: se la
 *  setter sposta l'appuntamento, non è più «preso dalla chat». */
export function presaDallaChat(d: LeadData): boolean {
  const m = (d as SchedaChat).prenotatoChat;
  if (!m || typeof m !== "object") return false;
  const g = testo(m.g);
  const o = oraDi(m.o);
  return !!g && !!o && g === testo(d.dataMeeting) && o === oraDi(d.oraMeeting);
}

const GIORNI_BREVI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
const due = (n: number) => String(n).padStart(2, "0");

/** «27/10 15:42 · Ha prenotato il cliente dalla chat WhatsApp: gio 29/10 18:00
 *  con Filippo». Ora di Roma; del consulente solo il nome di battesimo. */
function rigaDellaChat(p: DatiPrenotazione): string {
  const r = aRoma(p.adesso);
  const [, mese, giorno] = r.giorno.split("-");
  const adesso = `${giorno}/${mese} ${due(Math.floor(r.minuti / 60))}:${due(r.minuti % 60)}`;
  const [, mesePren, giornoPren] = p.giorno.split("-");
  const settimana = GIORNI_BREVI[new Date(`${p.giorno}T00:00:00Z`).getUTCDay()];
  const consulente = testo(p.nomeConsulente).split(/\s+/)[0];
  return (
    `${adesso} · Ha prenotato il cliente dalla chat WhatsApp: ` +
    `${settimana} ${giornoPren}/${mesePren} ${oraDi(p.ora)}${consulente ? ` con ${consulente}` : ""}`
  );
}

/** Aggiunge una riga in fondo alle note, separata da a-capo. Le note del CRM
 *  sono un testo libero (`LeadDialog`), senza struttura: si accoda e basta. */
export function conNota(note: string | undefined, riga: string): string {
  const base = note ?? "";
  if (!base.trim()) return riga;
  return base.endsWith("\n") ? base + riga : `${base}\n${riga}`;
}

/** Quello che farebbe `updateLead` del browser per questo salvataggio (vedi la
 *  testata), più il marcatore e la nota. Non modifica `prima`. */
export function daPrenotare(prima: LeadData, p: DatiPrenotazione): LeadData {
  const adessoIso = p.adesso.toISOString();
  let nuova: SchedaChat = {
    ...prima,
    stato: "appuntamento_fissato",
    consulenteId: p.consulenteId,
    dataMeeting: p.giorno,
    oraMeeting: p.ora,
    durataMeeting: p.durata,
    linkMeeting: p.link,
    prenotatoChat: { il: adessoIso, g: p.giorno, o: p.ora },
    note: conNota(prima.note, rigaDellaChat(p)),
  };
  //  `statoDal`: lo stato finale contro quello di prima, come in `updateLead`.
  nuova = conStatoDal(prima, nuova, p.adesso);
  //  Da dove veniva. ⚠️ `statoDa` no: il browser ci scrive l'id di chi lavora.
  if (nuova.stato !== prima.stato) {
    nuova = { ...nuova, statoPrecedente: prima.stato, statoPrecedenteIl: adessoIso };
  }
  //  Chi ha fissato: solo se la scheda non ha già qualcuno (D8). Nelle
  //  riprenotazioni resta la setter che l'aveva presa.
  nuova = {
    ...nuova,
    ...patchChiFissa({
      prima,
      statoNuovo: nuova.stato,
      chi: FISSATO_DA_CHAT,
      ora: p.adesso,
    }),
  };
  //  Entra in appuntamento: il conto delle chiamate riparte da 0, il totale resta (crm/chiamate).
  nuova = { ...nuova, ...patchAzzeraChiamate(prima, nuova, p.adesso) };
  //  L'ora del primo contatto: una volta sola, la prima volta che la scheda
  //  lascia «Da contattare».
  if (prima.stato === "da_contattare" && nuova.stato !== "da_contattare" && !nuova.firstContactAt) {
    nuova = { ...nuova, firstContactAt: adessoIso };
  }
  return nuova;
}

/** I campi su cui `daDisfare` confronta l'attuale con lo scritto. ⚠️ Non
 *  `fissatoDa`: nelle riprenotazioni resta quello della setter (D8). */
const CAMPI_DELLA_GUARDIA = [
  "stato",
  "consulenteId",
  "dataMeeting",
  "oraMeeting",
  "durataMeeting",
  "linkMeeting",
  "statoDal",
  "prenotatoChat",
] as const;

/** Tutti i campi che `daPrenotare` può toccare (le note a parte). */
const CAMPI_TOCCATI = [
  ...CAMPI_DELLA_GUARDIA,
  "statoPrecedente",
  "statoPrecedenteIl",
  "firstContactAt",
  "chiamate",
  "fissatoDa",
  "fissatoIl",
] as const;

/** Lo stesso valore, anche se le chiavi di un oggetto sono in ordine diverso
 *  (il JSONB del database le riordina). */
const ordinato = (v: unknown): string =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : x,
  ) ?? "undefined";

/** Rimette dal `prima` solo ciò che `daPrenotare` ha toccato, e solo se
 *  l'`attuale` combacia per valore con lo `scritto` sui campi della guardia.
 *  Altrimenti `null`: qualcuno ha cambiato la scheda e non si disfa alla cieca
 *  (l'orchestratore dà `errore` e il secondo stato «Da ricontattare»).
 *  Quello che nel frattempo è arrivato per altre strade (la risposta del
 *  cliente in `contattoWa`, una nota aggiunta) resta. Non modifica gli
 *  argomenti. */
export function daDisfare(attuale: LeadData, scritto: LeadData, prima: LeadData): LeadData | null {
  const a = attuale as unknown as Record<string, unknown>;
  const s = scritto as unknown as Record<string, unknown>;
  const p = prima as unknown as Record<string, unknown>;
  for (const k of CAMPI_DELLA_GUARDIA) if (ordinato(a[k]) !== ordinato(s[k])) return null;

  const fuori: Record<string, unknown> = { ...a };
  for (const k of CAMPI_TOCCATI) {
    //  Se qualcuno ha riscritto un campo che non è nella guardia (es. `fissatoDa`)
    //  non è più nostro: si lascia.
    if (ordinato(a[k]) !== ordinato(s[k])) continue;
    if (k in p) fuori[k] = p[k];
    else delete fuori[k];
  }

  //  La nota: se è ancora quella che abbiamo scritto torna com'era; se
  //  qualcuno ha aggiunto altro dopo, si toglie solo la nostra riga.
  const notaNostra = typeof s.note === "string" ? s.note : "";
  const notaPrima = typeof p.note === "string" ? p.note : "";
  if (a.note === s.note) {
    if ("note" in p) fuori.note = p.note;
    else delete fuori.note;
  } else if (typeof a.note === "string") {
    const aggiunta = notaNostra.startsWith(notaPrima)
      ? notaNostra.slice(notaPrima.length)
      : notaNostra;
    const i = aggiunta ? a.note.lastIndexOf(aggiunta) : -1;
    if (i >= 0) fuori.note = a.note.slice(0, i) + a.note.slice(i + aggiunta.length);
  }
  return fuori as unknown as LeadData;
}

/** Il secondo stato «Da ricontattare», col motivo (D12): la setter lo vede.
 *  Come `cambioAMano`/`dopoRifiuto` di `contatto.ts`: la patch e la voce di
 *  storia che la ricalca. ⚠️ Non mette `sbloccatoIl`: non è una persona che
 *  riapre il freno «mai due volte senza risposta». */
export function cambioRicontatto(motivo: MotivoContatto, adesso: Date): CambioContatto {
  const patch = {
    stato: "da_ricontattare" as const,
    il: adesso.toISOString(),
    da: DA_AUTOMATICO,
    motivo,
  };
  return { patch, voce: { ...patch } };
}
