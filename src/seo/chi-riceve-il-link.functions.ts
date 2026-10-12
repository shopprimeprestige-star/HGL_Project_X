/** ── A CHI È INTESTATO QUESTO LINK (PER L'ANTEPRIMA DI WHATSAPP) ─────────────
 *
 *  Segnalazione del titolare (12/10/2026): «quando invio il link Meetly non dà
 *  l'anteprima con nome e cognome della persona; anche quando crea il
 *  preventivo».
 *
 *  La causa: il nome stava SOLO dentro l'immagine del biglietto, e quella
 *  immagine esiste solo se il browser del consulente l'ha disegnata e
 *  depositata (api.anteprima) prima che WhatsApp legga il link. Se no — link
 *  copiato da un'altra schermata, deposito non partito, preventivo appena
 *  creato — WhatsApp riceve il marchio generico e un titolo uguale per tutti.
 *
 *  Da qui una seconda strada che non dipende da nessun browser: il SERVER, nel
 *  momento in cui il lettore di anteprime chiede la pagina, legge a chi è
 *  intestato il link e scrive nome e cognome nel titolo e nella descrizione.
 *  Il testo del riquadro è sempre giusto; l'immagine personale, quando c'è,
 *  resta in più.
 *
 *  ⚠️ COSA ESCE: solo nome, cognome, giorno e ora della consulenza. Mai prezzi,
 *   telefono o email. Il codice nell'indirizzo è la sola chiave (come per il
 *   biglietto, che porta già lo stesso nome a un indirizzo prevedibile).
 *  ⚠️ OGNI ERRORE = NULL: l'anteprima torna quella di prima, mai una pagina rotta.
 */
import { createServerFn } from "@tanstack/react-start";
import { chiaveAttesi, leggiAttesi } from "@/crm/fascia-consulenza";
import {
  codiceStanzaValido,
  leadUnicoDalleChiavi,
  pulito,
  sceltoFraGliAttesi,
  type Destinatario,
} from "./chi-riceve-il-link";

export type { Destinatario } from "./chi-riceve-il-link";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> };
        like: (k: string, v: string) => {
          like: (k: string, v: string) => { limit: (n: number) => Promise<{ data: unknown }> };
        };
      };
    };
  };
}

async function config(chiave: string): Promise<string> {
  const { data } = await (await db()).from("app_config").select("value").eq("key", chiave).maybeSingle();
  return String((data as { value?: string } | null)?.value ?? "");
}

async function daLead(leadId: string): Promise<Destinatario | null> {
  if (!leadId) return null;
  const { data } = await (await db()).from("crm_leads").select("data").eq("id", leadId).maybeSingle();
  const d = ((data as { data?: Record<string, unknown> } | null)?.data ?? {}) as Record<string, unknown>;
  const nome = pulito(d.nome);
  if (!nome) return null;
  return {
    nome,
    cognome: pulito(d.cognome),
    giorno: pulito(d.dataMeeting, 10) || undefined,
    ora: pulito(d.oraMeeting, 5) || undefined,
  };
}

/** La persona di una stanza Meetly: quella del gettone `?chi=` se c'è, se no
 *  l'unica attesa, se no il lead a cui la stanza è legata (`meet:<leadId>`). */
export async function destinatarioDellaStanza(codice: string, gettone?: string): Promise<Destinatario | null> {
  const stanza = codiceStanzaValido(codice);
  if (!stanza) return null;
  try {
    const attesi = leggiAttesi(await config(chiaveAttesi(stanza)));
    const scelto = sceltoFraGliAttesi(attesi, gettone);
    if (scelto) {
      const dalLead = await daLead(scelto.leadId);
      return dalLead ?? { nome: pulito(scelto.nome), cognome: pulito(scelto.cognome) };
    }
    if (attesi.length > 1) return null; // gruppo senza gettone: non si indovina un nome
    const { data } = await (await db())
      .from("app_config")
      .select("key")
      .like("key", "meet:%")
      .like("value", `%"code":"${stanza}"%`)
      .limit(10);
    const chiavi = ((data as { key?: string }[] | null) ?? []).map((r) => String(r.key ?? ""));
    return await daLead(leadUnicoDalleChiavi(chiavi));
  } catch {
    return null;
  }
}

/** La persona di un preventivo: dal suo numero (`?id=`/`?ref=`); se il
 *  preventivo non esiste ancora, dalla stanza della consulenza (`?sess=`). */
export async function destinatarioDelPreventivo(p: {
  id?: string;
  sess?: string;
  persona?: string;
}): Promise<Destinatario | null> {
  try {
    const ref = String(p.id ?? "").trim();
    if (/^[A-Za-z0-9-]{3,40}$/.test(ref)) {
      const { data } = await (await db())
        .from("quote_requests")
        .select("nome,cognome")
        .eq("quote_ref", ref)
        .maybeSingle();
      const r = data as { nome?: string; cognome?: string } | null;
      if (r && pulito(r.nome)) return { nome: pulito(r.nome), cognome: pulito(r.cognome) };
    }
    if (p.sess) return await destinatarioDellaStanza(p.sess, p.persona);
    return null;
  } catch {
    return null;
  }
}

export const leggiDestinatarioStanza = createServerFn({ method: "GET" })
  .inputValidator((d: { codice: string; chi?: string }) => ({
    codice: String(d?.codice ?? ""),
    chi: String(d?.chi ?? ""),
  }))
  .handler(async ({ data }) => destinatarioDellaStanza(data.codice, data.chi || undefined));

export const leggiDestinatarioPreventivo = createServerFn({ method: "GET" })
  .inputValidator((d: { id?: string; sess?: string; persona?: string }) => ({
    id: String(d?.id ?? ""),
    sess: String(d?.sess ?? ""),
    persona: String(d?.persona ?? ""),
  }))
  .handler(async ({ data }) => destinatarioDelPreventivo(data));
