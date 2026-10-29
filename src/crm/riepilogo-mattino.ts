/** ── IL RIEPILOGO DEL MATTINO ───────────────────────────────────────────────
 *
 *  Commessa 2026-10-30 (idea 16): ogni mattina ogni consulente riceve, sul
 *  telefono (notifica push) e per email se il canale c'è (Resend), quanto
 *  lavoro ha oggi: consulenze, da chiamare, chi ha risposto, richiami scaduti.
 *  Il titolare riceve i totali, più chi non è di nessuno e i numeri doppi.
 *  Lo manda la rotta /hooks/riepilogo-mattino (cron); qui solo i conti e i
 *  testi, senza rete.
 *
 *  ⚠️ SOLO NUMERI, MAI NOMI NÉ TELEFONI DEI CLIENTI. La notifica si legge a
 *   schermo bloccato (decisione del titolare del 28/10, crm/push/avviso) e
 *   l'email esce dal CRM: i nomi si guardano dentro, in «Da fare oggi».
 *  ⚠️ MAI WHATSAPP AUTOMATICO (vincolo della commessa).
 *  ⚠️ I «DA CHIAMARE» SONO QUELLI DI «CHI CHIAMARE ADESSO» (crm/chi-chiamare-
 *   adesso): se il riepilogo contasse con un'altra regola, il primo clic
 *   smentirebbe il numero della notifica.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { Lead } from "@/crm/types";
import { eAppuntamento } from "@/crm/types";
import { classificaAdesso } from "@/crm/chi-chiamare-adesso";
import { doppioniPerTelefono } from "@/crm/doppioni";
import { aRoma } from "@/crm/promemoria/formati";
import type { AvvisoPush } from "@/crm/push/avviso";

export interface ConteggiMattino {
  consulenzeOggi: number;
  daChiamare: number;
  risposti: number;
  richiami: number;
}

export interface RiepilogoConsulente extends ConteggiMattino {
  id: string;
  nome: string;
  email: string;
}

export interface RiepilogoTitolare extends ConteggiMattino {
  /** Da chiamare senza nessun consulente assegnato. */
  senzaConsulente: number;
  /** Numeri di telefono con più di una scheda ancora in gioco. */
  doppioni: number;
}

export interface RiepilogoMattino {
  giorno: string;
  perConsulente: RiepilogoConsulente[];
  titolare: RiepilogoTitolare;
}

type ConsulenteMinimo = { id: string; data?: { nome?: string; email?: string; attivo?: boolean } | null };

function conta(leads: Lead[], adesso: Date, giorno: string, id?: string | null): ConteggiMattino {
  const voci = classificaAdesso(leads, adesso, id);
  const consulenzeOggi = leads.filter(
    (l) =>
      !!l?.data &&
      (id == null || String(l.data.consulenteId ?? "") === id) &&
      eAppuntamento(l.data.stato) &&
      String(l.data.dataMeeting ?? "").slice(0, 10) === giorno,
  ).length;
  return {
    consulenzeOggi,
    daChiamare: voci.length,
    risposti: voci.filter((v) => v.motivo === "risposto").length,
    richiami: voci.filter((v) => v.motivo === "richiamo").length,
  };
}

export function riepilogoMattino(p: {
  leads: Lead[] | null | undefined;
  consulenti: ConsulenteMinimo[] | null | undefined;
  adesso: Date;
}): RiepilogoMattino {
  const leads = (p.leads ?? []).filter((l): l is Lead => !!l?.data);
  const { giorno } = aRoma(p.adesso);
  const perConsulente = (p.consulenti ?? [])
    .filter((c) => !!c?.id && c.data?.attivo !== false)
    .map((c) => ({
      id: c.id,
      nome: String(c.data?.nome ?? "").trim(),
      email: String(c.data?.email ?? "").trim(),
      ...conta(leads, p.adesso, giorno, c.id),
    }));
  return {
    giorno,
    perConsulente,
    titolare: {
      ...conta(leads, p.adesso, giorno),
      senzaConsulente: classificaAdesso(leads, p.adesso, "").length,
      doppioni: doppioniPerTelefono(leads).length,
    },
  };
}

/** C'è qualcosa da dire? A zero non si sveglia nessuno. */
export function daMandare(r?: Partial<RiepilogoTitolare> | null): boolean {
  return (
    !!r &&
    ((r.consulenzeOggi ?? 0) > 0 ||
      (r.daChiamare ?? 0) > 0 ||
      (r.senzaConsulente ?? 0) > 0 ||
      (r.doppioni ?? 0) > 0)
  );
}

const uno = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

/** Le frasi, una per numero che non è zero. */
function frasi(r: ConteggiMattino & Partial<RiepilogoTitolare>): string[] {
  const out: string[] = [];
  if (r.consulenzeOggi) out.push(uno(r.consulenzeOggi, "consulenza oggi", "consulenze oggi"));
  if (r.daChiamare)
    out.push(
      `${r.daChiamare} da chiamare` +
        (r.risposti ? ` (${uno(r.risposti, "ha risposto", "hanno risposto")})` : ""),
    );
  if (r.richiami) out.push(uno(r.richiami, "richiamo scaduto", "richiami scaduti"));
  if (r.senzaConsulente) out.push(`${r.senzaConsulente} senza consulente`);
  if (r.doppioni) out.push(uno(r.doppioni, "numero doppio", "numeri doppi"));
  return out;
}

const giornoCorto = (g: string) => g.split("-").reverse().slice(0, 2).join("/");

export function avvisoRiepilogo(
  r: ConteggiMattino & { nome?: string } & Partial<RiepilogoTitolare>,
  giorno: string,
): AvvisoPush {
  const nome = String(r.nome ?? "").trim().slice(0, 40);
  return {
    titolo: nome ? `Buongiorno ${nome}` : "Buongiorno",
    corpo: frasi(r).join(" · ") || "Oggi niente in agenda",
    //  Una al giorno: se il giro ripartisse, la notifica si sostituisce.
    chiave: `riepilogo:${giorno}`,
    destinazione: "/CRM/dafare",
  };
}

const sicuro = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

export function emailRiepilogo(
  r: ConteggiMattino & { nome?: string } & Partial<RiepilogoTitolare>,
  giorno: string,
  sito: string,
): { oggetto: string; html: string } {
  const link = `${String(sito || "").replace(/\/+$/, "")}/CRM/dafare`;
  const nome = String(r.nome ?? "").trim();
  const righe = frasi(r);
  return {
    oggetto: `La tua giornata del ${giornoCorto(giorno)}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1f2937">
<p style="margin:0 0 12px">Buongiorno${nome ? ` ${sicuro(nome)}` : ""},</p>
<ul style="margin:0 0 16px;padding-left:20px">${(righe.length ? righe : ["oggi niente in agenda"]).map((x) => `<li>${sicuro(x)}</li>`).join("")}</ul>
<p style="margin:0"><a href="${sicuro(link)}">Apri «Da fare oggi»</a>: in cima trovi chi chiamare adesso.</p>
</div>`,
  };
}
