/** ── I CODICI E GLI ORDINI, DAL GESTIONALE ─────────────────────────────────
 *
 *  GET  ?azione=elenco   → i codici, i più recenti in cima
 *  GET  ?azione=ordini   → gli ordini, come un piccolo negozio
 *  GET  ?azione=cerca&q= → i lead che somigliano a quello che si sta scrivendo
 *  POST { azione: "crea" | "aggiorna" | "elimina" | "regala" }
 *
 *  ── ⚠️ LA RICERCA DEL LEAD CERCA SU TRE CAMPI ────────────────────────────
 *  Numero, email, nome e cognome. Chi crea un codice ha davanti una chat di
 *  WhatsApp: ha il numero, a volte solo il nome. Costringerlo a cercare per un
 *  campo solo vuol dire che il codice lo fa senza collegarlo a nessuno — e un
 *  codice senza lead è un incasso che non si sa di chi è.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  aggiornaCodice, aggiungiProve, creaCodice, eliminaCodice, tuttiGliOrdini, tuttiICodici,
} from "@/prova/archivio.server";
import { leggibile, normalizza, nuovoCodice, PROVE_COMPRESE } from "@/prova/codici";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chiamanteCRM, nonAutenticatoCRM, vietatoCRM } from "./api.crm.accesso";

const PERMESSO = "impostazioni" as const;
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

async function guardia(request: Request): Promise<Response | null> {
  const chi = await chiamanteCRM(request);
  if (!chi) return nonAutenticatoCRM({});
  if (!chi.accesso.puo(PERMESSO)) return vietatoCRM({}, PERMESSO);
  return null;
}

/** ⚠️ Il codice si sorteggia finché non ne esce uno libero. Con ventisei
 *  caratteri su otto posizioni la collisione è quasi impossibile, ma «quasi»
 *  su un codice d'accesso vuol dire che un giorno due clienti diversi si
 *  ritrovano lo stesso codice e le prove dell'uno le consuma l'altro. */
async function codiceLibero(): Promise<string> {
  const tutti = await tuttiICodici();
  const presi = new Set(tutti.map((c) => normalizza(c.codice)));
  for (let i = 0; i < 50; i += 1) {
    const c = nuovoCodice();
    if (!presi.has(normalizza(c))) return c;
  }
  throw new Error("non riesco a trovare un codice libero");
}

export const Route = createFileRoute("/api/crm/prova-codici")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const no = await guardia(request);
        if (no) return no;
        const url = new URL(request.url);
        const azione = url.searchParams.get("azione") || "elenco";

        //  Il numero a cui scrivere dal risultato, e il testo già pronto.
        if (azione === "contatto") {
          const { data } = await supabaseAdmin
            .from("app_config").select("value").eq("key", "prova_capelli_contatto").maybeSingle();
          return json({ ok: true, ...(JSON.parse((data as { value?: string } | null)?.value ?? "{}") || {}) });
        }

        if (azione === "ordini") {
          return json({ ok: true, ordini: await tuttiGliOrdini() });
        }

        if (azione === "cerca") {
          const q = (url.searchParams.get("q") || "").trim();
          //  Sotto i due caratteri si cerca tutto l'archivio per niente: si
          //  torna vuoto e basta.
          if (q.length < 2) return json({ ok: true, lead: [] });
          const cifre = q.replace(/[^\d]/g, "");
          const pezzi = [
            `data->>nome.ilike.%${q}%`,
            `data->>cognome.ilike.%${q}%`,
            `data->>email.ilike.%${q}%`,
            //  ⚠️ Sul telefono si cercano le ULTIME cifre: la gente scrive il
            //   numero col prefisso, senza, con gli spazi o col +39, e cercare
            //   la stringa intera non trova mai niente.
            ...(cifre.length >= 4 ? [`data->>telefono.ilike.%${cifre.slice(-9)}%`] : []),
          ];
          try {
            const db = supabaseAdmin as unknown as {
              from: (t: string) => { select: (c: string) => { or: (q: string) => { limit: (n: number) => Promise<{ data?: unknown[] }> } } };
            };
            const r = await db.from("crm_leads").select("id, data").or(pezzi.join(",")).limit(12);
            const lead = (r.data ?? []).map((x) => {
              const l = x as { id: string; data?: Record<string, unknown> };
              return {
                id: l.id,
                nome: String(l.data?.nome ?? ""),
                cognome: String(l.data?.cognome ?? ""),
                telefono: String(l.data?.telefono ?? ""),
                email: String(l.data?.email ?? ""),
                stato: String(l.data?.stato ?? ""),
              };
            });
            return json({ ok: true, lead });
          } catch (e) {
            return json({ ok: false, error: String((e as Error).message || e) }, 502);
          }
        }

        const codici = await tuttiICodici();
        return json({
          ok: true,
          comprese: PROVE_COMPRESE,
          codici: codici.map((c) => ({ ...c, codice: leggibile(c.codice) })),
        });
      },

      POST: async ({ request }) => {
        const no = await guardia(request);
        if (no) return no;
        let b: {
          azione?: string; codice?: string; leadId?: string; nota?: string;
          nome?: string; cognome?: string; telefono?: string; email?: string;
          prove?: number; bloccato?: boolean; admin?: boolean;
          numero?: string; messaggio?: string;
        };
        try { b = (await request.json()) as typeof b; } catch { return json({ error: "richiesta illeggibile" }, 400); }

        //  ⚠️ Il numero si salva com'è scritto e si normalizza al momento di
        //   costruire il link: qui dentro deve restare leggibile a chi lo
        //   rilegge nel gestionale.
        if (b.azione === "contatto") {
          await supabaseAdmin.from("app_config").upsert(
            {
              key: "prova_capelli_contatto",
              value: JSON.stringify({
                numero: String(b.numero ?? "").trim(),
                messaggio: String(b.messaggio ?? "").trim(),
              }),
              updated_at: new Date().toISOString(),
            } as never,
            { onConflict: "key" },
          );
          return json({ ok: true });
        }

        if (b.azione === "crea") {
          const codice = await codiceLibero();
          const fatto = await creaCodice({
            codice,
            totali: Math.max(1, Number(b.prove ?? PROVE_COMPRESE)),
            leadId: b.leadId, nome: b.nome, cognome: b.cognome,
            telefono: b.telefono, email: b.email, nota: b.nota, admin: !!b.admin,
          });
          return json({ ok: true, codice: { ...fatto, codice: leggibile(fatto.codice) } });
        }

        if (b.azione === "aggiorna") {
          const fatto = await aggiornaCodice(String(b.codice || ""), {
            ...(b.leadId !== undefined ? { leadId: b.leadId } : {}),
            ...(b.nome !== undefined ? { nome: b.nome } : {}),
            ...(b.cognome !== undefined ? { cognome: b.cognome } : {}),
            ...(b.telefono !== undefined ? { telefono: b.telefono } : {}),
            ...(b.email !== undefined ? { email: b.email } : {}),
            ...(b.nota !== undefined ? { nota: b.nota } : {}),
            ...(b.bloccato !== undefined ? { bloccato: b.bloccato } : {}),
            ...(b.admin !== undefined ? { admin: b.admin } : {}),
          });
          return json({ ok: !!fatto, codice: fatto ? { ...fatto, codice: leggibile(fatto.codice) } : null });
        }

        //  Regalare prove: serve dopo una telefonata andata bene, o quando
        //  qualcosa è andato storto e si rimedia. È il gesto che evita un
        //  rimborso, e deve costare un clic.
        if (b.azione === "regala") {
          const fatto = await aggiungiProve(String(b.codice || ""), Math.max(1, Number(b.prove || 1)));
          return json({ ok: !!fatto, codice: fatto ? { ...fatto, codice: leggibile(fatto.codice) } : null });
        }

        if (b.azione === "elimina") {
          await eliminaCodice(String(b.codice || ""));
          return json({ ok: true });
        }

        return json({ error: "azione sconosciuta" }, 400);
      },
    },
  },
});
