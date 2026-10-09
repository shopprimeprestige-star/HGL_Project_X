/** AZIONI DEL CONSULENTE SUI PROPRI LEAD ────────────────────────────────────
 *  POST { token, leadId, azione, valori? }   azione ∈ "stato" | "note" | "richiamo"
 *
 *  Regola non negoziabile: un consulente tocca SOLO i lead che gli sono stati
 *  assegnati. Il controllo non sta nell'interfaccia — che chiunque può
 *  scavalcare chiamando la rotta a mano — ma qui, confrontando
 *  data.consulenteId con il consulente della sessione. Se non coincidono la
 *  risposta è { ok:false, reason:"non assegnato" } e nulla viene scritto.
 *
 *  Il token si legge come nella rotta di login: chiave app_config 'csess:<token>'
 *  e dodici ore di validità. La verifica è ripetuta qui invece di essere
 *  importata dall'altra rotta perché due file di rotta non devono dipendere
 *  l'uno dall'altro, e questo codice non può finire in un modulo condiviso col
 *  client (userebbe la service role key).
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  applyAutoStatus,
  eChiusuraVinta,
  MODO_CONSEGNA_DA_STATO,
  statiPer,
  type ConsultantPermissions,
  type LeadData,
  type LeadStatus,
} from "@/crm/types";
//  Una sola tabella di verità: `risolviAccesso` legge il LIVELLO e le deroghe
//  della riga del PIN e ne ricava anche i tre campi storici. Leggerli qui a
//  mano significherebbe due risposte diverse alla stessa domanda — il CRM che
//  vieta di cancellare un lead e l'area mobile che lo lascia fare.
import { risolviAccesso } from "@/crm/permessi";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const PREFISSO = "csess:";
const DURATA_MS = 12 * 60 * 60 * 1000;
/** Le note arrivano da una textarea: senza un tetto una sola riga può gonfiare
 *  il jsonb del lead a piacere di chi chiama. */
const MAX_NOTA = 5000;

/** ── QUANDO SI SEGNA LA DATA DELLA CONVERSIONE ────────────────────────────
 *  ⚠️ Era un elenco scritto a mano fermo al vecchio "venduto". Da qui passano
 *   gli esiti segnati dal telefono del consulente: una vendita chiusa lì non
 *   scriveva `convertedAt`, quindi tornava attribuita al giorno in cui il lead
 *   era ENTRATO — un altro mese, un'altra campagna. La stessa riga esiste in
 *   crm/CRMContext.tsx per il CRM da computer, e le due devono dire la stessa
 *   cosa: si legge da `eChiusuraVinta`, che è l'unico elenco. */
const eConvertito = (s?: LeadStatus | string | null): boolean =>
  eChiusuraVinta(s) || s === "concluso";

interface Sessione { consultantId: string; adminUserId: string; at: string }

const tokenPulito = (v: unknown): string => {
  const t = String(v ?? "").trim().toLowerCase();
  return /^[a-f0-9]{32,128}$/.test(t) ? t : "";
};

const isData = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isOra = (v: string) => /^\d{2}:\d{2}$/.test(v);

async function leggiSessione(raw: unknown): Promise<Sessione | null> {
  const token = tokenPulito(raw);
  if (!token) return null;
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", PREFISSO + token).limit(1);
  const value = (data as { value?: string | null }[] | null)?.[0]?.value;
  if (!value) return null;
  let s: Partial<Sessione>;
  try { s = JSON.parse(value) as Partial<Sessione>; } catch { return null; }
  if (!s.consultantId || !s.at) return null;
  const nata = Date.parse(s.at);
  if (!Number.isFinite(nata) || Date.now() - nata > DURATA_MS) {
    await supabaseAdmin.from("app_config").delete().eq("key", PREFISSO + token);
    return null;
  }
  return { consultantId: s.consultantId, adminUserId: s.adminUserId ?? "", at: s.at };
}

/** Permessi riletti a ogni azione, non salvati nella sessione: toglierne uno
 *  dall'admin deve avere effetto subito, anche su chi è già dentro. */
async function permessiDi(s: Sessione): Promise<{ permessi: ConsultantPermissions; adminUserId: string } | null> {
  const { data } = await supabaseAdmin
    .from("consultant_pins")
    .select("permissions, admin_user_id")
    .eq("consultant_id", s.consultantId)
    .eq("active", true)
    .limit(1);
  const pin = data?.[0];
  if (!pin) return null;
  //  ── ⚠️ E I MESTIERI, CHE STANNO NELL'ALTRA TABELLA ──────────────────────
  //   Da quando il permesso è l'unione di ciò che serve a ogni mestiere acceso
  //   (crm/permessi.ts), la sola riga del PIN non basta più a rispondere: senza
  //   questa lettura chi fa il consulente si vedrebbe rifiutare la registrazione
  //   di un incasso proprio qui, nell'area in cui lavora dal telefono, mentre
  //   nel CRM la stessa persona ce l'ha. Una richiesta in più per azione, ed è
  //   la stessa che fa già ogni altra rotta che legge i permessi.
  //   Riga assente = non lo sappiamo: si passa `null`, che vale «comanda il
  //   livello», cioè il ripiego meno potente.
  const { data: righe } = await supabaseAdmin
    .from("crm_consultants")
    .select("data")
    .eq("id", s.consultantId)
    .limit(1);
  const dati = (righe?.[0]?.data ?? null) as unknown;
  return {
    permessi: risolviAccesso(pin.permissions, dati).legacy,
    adminUserId: s.adminUserId || pin.admin_user_id,
  };
}

interface Valori {
  stato?: string;
  note?: string;
  notePostCall?: string;
  dataRicontatto?: string;
  oraRicontatto?: string;
}

export const Route = createFileRoute("/api/consulente/azione")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        let b: { token?: string; leadId?: string; azione?: string; valori?: Valori } = {};
        try { b = (await request.json()) as typeof b; } catch { /* corpo illeggibile = richiesta incompleta */ }

        const azione = String(b.azione ?? "").trim();
        const leadId = String(b.leadId ?? "").trim();
        if (!leadId) return json({ ok: false, reason: "lead mancante" });
        if (azione !== "stato" && azione !== "note" && azione !== "richiamo") {
          return json({ ok: false, reason: "azione non supportata" });
        }

        const sessione = await leggiSessione(b.token);
        if (!sessione) return json({ ok: false, reason: "sessione scaduta" });
        const accesso = await permessiDi(sessione);
        if (!accesso) return json({ ok: false, reason: "accesso revocato" });
        const { permessi, adminUserId } = accesso;

        const { data: righe } = await supabaseAdmin
          .from("crm_leads")
          .select("id, data")
          .eq("id", leadId)
          .eq("user_id", adminUserId)
          .limit(1);
        const riga = righe?.[0];
        if (!riga) return json({ ok: false, reason: "lead non trovato" });

        const attuale = (riga.data ?? {}) as unknown as LeadData;
        // ── IL CONTROLLO CHE CONTA ────────────────────────────────────────────
        //  Confronto in stringa perché consulenteId può arrivare come uuid o
        //  come null: un `==` distratto qui aprirebbe l'archivio di tutti.
        if (String(attuale.consulenteId ?? "") !== String(sessione.consultantId)) {
          return json({ ok: false, reason: "non assegnato" });
        }

        const v = (b.valori ?? {}) as Valori;
        const patch: Partial<LeadData> = {};

        if (azione === "stato") {
          if (!permessi.canChangeStatus) return json({ ok: false, reason: "permesso mancante" });
          const stato = String(v.stato ?? "").trim() as LeadStatus;
          // L'elenco ammesso è quello che il CRM mostrerebbe per QUESTO lead:
          // una lista da chiamare e una trattativa avviata non hanno gli stessi
          // esiti, e la rotta non può essere più permissiva dell'interfaccia.
          if (!statiPer(attuale).includes(stato)) return json({ ok: false, reason: "stato non ammesso" });
          patch.stato = stato;
          //  ── SE HA COMPRATO, SI SCRIVE ANCHE COME GLI ARRIVA L'IMPIANTO ────
          //   Lo stato e `installazione.spedizione.modo` vanno insieme: lo stato
          //   decide fase e conteggi, il modo decide se la pratica occupa un
          //   tecnico o parte come pacco. Nel CRM da computer li scrive insieme
          //   ChiusuraDialog; qui non c'era nessuno, e da questa rotta una
          //   vendita segnata «Da spedire» dal telefono restava in agenda come
          //   una posa — cioè un tecnico in viaggio per un pacco.
          //   ⚠️ Quello che questa rotta NON può ancora scrivere sono gli
          //    IMPORTI: dal telefono la vendita si registra senza un euro (vedi
          //    la nota nel resoconto). Il modo di consegna almeno non si perde.
          const modo = MODO_CONSEGNA_DA_STATO[stato];
          if (modo) {
            patch.installazione = {
              ...(attuale.installazione ?? {}),
              spedizione: {
                ...(attuale.installazione?.spedizione ?? {}),
                modo,
                daSpedire: modo === "spedizione",
              },
            };
          }
        }

        if (azione === "note") {
          const nota = v.note;
          const postCall = v.notePostCall;
          if (nota === undefined && postCall === undefined) return json({ ok: false, reason: "nessuna nota" });
          if (nota !== undefined) {
            if (!permessi.canAddNotes) return json({ ok: false, reason: "permesso mancante" });
            patch.note = String(nota).slice(0, MAX_NOTA);
          }
          if (postCall !== undefined) {
            if (!permessi.canAddPostCallNotes) return json({ ok: false, reason: "permesso mancante" });
            patch.notePostCall = String(postCall).slice(0, MAX_NOTA);
          }
        }

        if (azione === "richiamo") {
          // Spostare la data di un richiamo è a tutti gli effetti spostare un
          // impegno in agenda: vale lo stesso permesso degli orari.
          if (!permessi.canChangeTime) return json({ ok: false, reason: "permesso mancante" });
          const giorno = String(v.dataRicontatto ?? "").trim();
          if (!isData(giorno)) return json({ ok: false, reason: "data non valida" });
          patch.dataRicontatto = giorno;
          const ora = String(v.oraRicontatto ?? "").trim();
          if (ora) {
            if (!isOra(ora)) return json({ ok: false, reason: "ora non valida" });
            patch.oraRicontatto = ora;
          }
        }

        // Stessa catena del CRM admin (CRMContext.updateLead): gli automatismi
        // di stato e la data di conversione devono valere anche quando la
        // modifica arriva dal consulente, altrimenti le KPI divergono a seconda
        // di chi ha toccato il lead.
        let aggiornato = applyAutoStatus({ ...attuale, ...patch } as LeadData);
        const eraConvertito = eConvertito(attuale.stato);
        const oraConvertito = eConvertito(aggiornato.stato);
        if (!eraConvertito && oraConvertito && !aggiornato.convertedAt) {
          aggiornato = { ...aggiornato, convertedAt: new Date().toISOString() };
        }

        const { error } = await supabaseAdmin
          .from("crm_leads")
          .update({ data: aggiornato as never })
          .eq("id", leadId)
          .eq("user_id", adminUserId);
        if (error) return json({ ok: false, reason: "salvataggio non riuscito" });

        return json({ ok: true, lead: { id: leadId, data: aggiornato } });
      },
    },
  },
});
