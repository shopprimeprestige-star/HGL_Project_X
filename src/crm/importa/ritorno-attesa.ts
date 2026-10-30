/** ── CHI TORNA VA IN «ATTESA WHATSAPP» ─────────────────────────────────────
 *  File leggero (solo i tipi): lo leggono la ricarica delle liste
 *  (crm/importa/ricarico), il giro di ManyChat (crm/manychat/sequenze) e il
 *  cron del server (routes/hooks/attesa-da-chiamare). Prove in
 *  prove/idee/ritorno-in-attesa.mjs.
 *  ───────────────────────────────────────────────────────────────────────── */
import { STATI_APPUNTAMENTO, STATI_VINTI, type LeadData, type LeadStatus } from "@/crm/types";

/** ── CHI TORNA VA IN «ATTESA WHATSAPP» (30/10/2026) ───────────────────────
 *  Richiesta del titolare: chi ricompare (modulo, foglio, file) passa da solo
 *  in «Attesa WhatsApp», qualunque fosse lo stato; quello di prima resta in
 *  `statoPrecedente`/`statoPrecedenteIl` (come le altre transizioni automatiche,
 *  crm/importa/attesa-da-chiamare) e in `ricarico.statoAllora`, e si legge
 *  sotto lo stato («prima: Non interessato», `primaDelRitorno`).
 *  ⚠️ NON SI SPOSTA chi ha un appuntamento (fissato, rifissato, in sede), un
 *   acconto (stato o soldi incassati), chi sta per pagarlo («Attesa acconto») e
 *   chi ha comprato: lì il ritorno è una richiesta del cliente su una pratica
 *   viva, e lo stato dice cose che «Attesa WhatsApp» cancellerebbe.
 *  `ricarico.inAttesaIl` dice che lo stato l'ha cambiato il ritorno: serve a
 *  raccontare il «prima» e a non spostare la stessa scheda due volte. */
export const STATI_CHE_RESTANO_AL_RITORNO: LeadStatus[] = [
  ...STATI_APPUNTAMENTO,
  "viene_in_sede",
  "in_attesa_acconto",
  ...STATI_VINTI,
];
const STATO_DEL_RITORNO: LeadStatus = "attesa_whatsapp";
/** Gli stati in cui il ritorno lascia la scheda da solo: «Attesa WhatsApp» e,
 *  dieci ore dopo senza risposta, «Da chiamare» (hooks/attesa-da-chiamare). */
const STATI_AUTOMATICI: string[] = [STATO_DEL_RITORNO, "da_chiamare"];

/** Lo stato da scrivere quando torna, o `null` se resta com'è. */
export function patchAttesaDelRitorno(
  d: Partial<LeadData> | null | undefined,
  ora: Date,
): Partial<LeadData> | null {
  const stato = d?.stato as string | undefined;
  if (stato === STATO_DEL_RITORNO) return null;
  if (stato && (STATI_CHE_RESTANO_AL_RITORNO as string[]).includes(stato)) return null;
  if (Number(d?.payment?.accontoPagato) > 0) return null;
  const iso = ora.toISOString();
  return {
    stato: STATO_DEL_RITORNO,
    ...(stato ? { statoPrecedente: stato as LeadStatus } : {}),
    statoPrecedenteIl: iso,
    statoDal: iso,
  };
}

/** Lo stato che aveva prima che il ritorno lo spostasse, finché la scheda è
 *  ancora negli stati automatici. Cambiato a mano = `null`: il «prima» non
 *  racconta più lo stato di adesso. */
export function statoPrimaDelRitorno(d?: Partial<LeadData> | null): LeadStatus | null {
  const r = d?.ricarico;
  if (!r?.inAttesaIl || !r.statoAllora || r.statoAllora === d?.stato) return null;
  return STATI_AUTOMATICI.includes(String(d?.stato ?? "")) ? r.statoAllora : null;
}

/** ── CHI ERA GIÀ TORNATO E NON È STATO TOCCATO ────────────────────────────
 *  Per il giro del server (hooks/attesa-da-chiamare): la stessa regola per chi
 *  è tornato prima del 30/10. Si sposta SOLO se lo stato è ancora quello di
 *  quando è tornato (`statoAllora`) e nessuno l'ha cambiato dopo il ritorno
 *  (`statoPrecedenteIl`/`statoDal` non successivi a `ricarico.ultimo`).
 *  ⚠️ Senza `statoAllora` (schede vecchie) non si sa: resta com'è. */
export function patchRitornoRimastoIndietro(
  d: Partial<LeadData> | null | undefined,
  ora: Date,
): Partial<LeadData> | null {
  const r = d?.ricarico;
  if (!r || !(Number(r.volte) >= 1) || r.inAttesaIl || !r.statoAllora || d?.stato !== r.statoAllora) return null;
  const ultimo = Date.parse(String(r.ultimo ?? ""));
  if (!Number.isFinite(ultimo)) return null;
  const cambiatoDopo = [d?.statoPrecedenteIl, d?.statoDal].some((x) => Date.parse(String(x ?? "")) > ultimo);
  if (cambiatoDopo) return null;
  const attesa = patchAttesaDelRitorno(d, ora);
  if (!attesa) return null;
  return { ...attesa, ricarico: { ...d!.ricarico!, inAttesaIl: ora.toISOString() } };
}
