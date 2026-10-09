/** ── TENERSI UN'ANTEPRIMA ──────────────────────────────────────────────────
 *
 *  POST { codice, immagine, taglio, colore } → la salva su Storage e la
 *  attacca alla scheda del cliente collegato a quel codice.
 *
 *  ── ⚠️ PERCHÉ FINISCE SULLA SCHEDA E NON IN UN ALBUM A PARTE ─────────────
 *  Fra un mese, chi richiama quella persona ha davanti la sua scheda e nessun
 *  altro posto. Un album separato è una cosa che si apre due volte e poi mai
 *  più — e le foto che ci stanno dentro tanto vale non averle fatte.
 *
 *  ── ⚠️ E SI TIENE L'INDIRIZZO, NON L'IMMAGINE ────────────────────────────
 *  Sulla scheda va un link a Storage, non un megabyte di base64: una scheda
 *  lead si rilegge decine di volte al giorno, e riscaricare ogni volta dieci
 *  anteprime dentro il JSON la farebbe strisciare.
 */
import { createFileRoute } from "@tanstack/react-router";
import { aggiornaCodice, anteprimeDi, segnaInviate, trovaCodice } from "@/prova/archivio.server";
import { formaValida } from "@/prova/codici";
import { salvaImmagine } from "@/prova/catalogo.server";
import { attaccaAlLead } from "@/prova/anteprime-lead.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** Quante se ne tengono per persona. ⚠️ Venti: oltre, la scheda del lead
 *  diventa un album e il resto — telefono, stato, note — finisce sotto la
 *  piega. Le più vecchie escono per prime. */
const TETTO = 20;

export const Route = createFileRoute("/api/public/prova-anteprima")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      /** ── CERCARE LA SCHEDA A CUI MANDARLE ─────────────────────────────
       *  ⚠️ SOLO CON UN CODICE ADMIN. È una rotta pubblica: senza questa
       *   guardia chiunque scrivesse due lettere nell'indirizzo otterrebbe
       *   nome, telefono ed email dei clienti dello studio. Il codice admin
       *   ce l'ha chi lavora qui, e nessun altro.
       *  ⚠️ E si restituisce il minimo per riconoscere una persona: nome,
       *   cognome, e del telefono solo le ultime quattro cifre. Basta a non
       *   sbagliare Rossi con Rossi, e non è una rubrica esportabile. */
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("cerca") || "").trim();
        const scheda = await trovaCodice(String(url.searchParams.get("codice") || ""));
        if (!scheda?.admin) return json({ ok: false, errore: "non consentito" }, 403);
        if (q.length < 2) return json({ ok: true, lead: [] });

        const cifre = q.replace(/[^\d]/g, "");
        const pezzi = [
          `data->>nome.ilike.%${q}%`,
          `data->>cognome.ilike.%${q}%`,
          `data->>email.ilike.%${q}%`,
          //  ⚠️ Sul telefono si cercano le ULTIME cifre: il numero è scritto
          //   col prefisso, senza, con gli spazi o col +39, e cercare la
          //   stringa intera non trova mai niente.
          ...(cifre.length >= 4 ? [`data->>telefono.ilike.%${cifre.slice(-9)}%`] : []),
        ];
        try {
          const db = supabaseAdmin as unknown as {
            from: (t: string) => { select: (c: string) => { or: (q: string) => { limit: (n: number) => Promise<{ data?: unknown[] }> } } };
          };
          const r = await db.from("crm_leads").select("id, data").or(pezzi.join(",")).limit(10);
          const lead = (r.data ?? []).map((x) => {
            const l = x as { id: string; data?: Record<string, unknown> };
            const tel = String(l.data?.telefono ?? "").replace(/[^\d]/g, "");
            return {
              id: l.id,
              nome: String(l.data?.nome ?? ""),
              cognome: String(l.data?.cognome ?? ""),
              coda: tel ? tel.slice(-4) : "",
            };
          });
          return json({ ok: true, lead });
        } catch (e) {
          return json({ ok: false, errore: String((e as Error).message || e) }, 502);
        }
      },

      POST: async ({ request }) => {
        let b: { codice?: string; immagine?: string; taglio?: string; colore?: string; azione?: string; leadId?: string; ids?: string[]; meet?: string };
        try { b = (await request.json()) as typeof b; } catch { return json({ ok: false, errore: "richiesta illeggibile" }, 400); }

        const codice = String(b.codice || "");
        if (!formaValida(codice)) return json({ ok: false, errore: "Serve il tuo codice." }, 401);
        const scheda = await trovaCodice(codice);
        if (!scheda) return json({ ok: false, errore: "Questo codice non esiste." }, 401);

        /** ── ⚠️ MANDARE LE PROVE SULLA SCHEDA, TUTTE INSIEME ──────────────
         *  Chi lavora con un codice admin — in negozio o in videoconsulenza —
         *  fa le prove per una persona che sta lì davanti, e il codice non è
         *  suo: è dello studio. Quindi le prove non hanno nessuna scheda dove
         *  andare, e restano in una fila che a fine giornata contiene le facce
         *  di dieci clienti diversi.
         *  Qui si sceglie la persona una volta e ci vanno tutte; e da quel
         *  momento escono dalla fila (`inviata`), perché sono archiviate
         *  altrove — la fila torna vuota per il cliente dopo.
         *  ⚠️ Vale solo per i codici admin: a un cliente normale le prove ci
         *   vanno già da sole, e un tasto che sposta roba nel gestionale in
         *   mano a chiunque non è una funzione, è un buco. */
        if (b.azione === "invia") {
          if (!scheda.admin) return json({ ok: false, errore: "non consentito" }, 403);
          const leadId = String(b.leadId || scheda.leadId || "");
          if (!leadId) return json({ ok: false, errore: "Scegli la scheda del cliente." }, 400);

          const tutte = await anteprimeDi(codice, { meet: String(b.meet || "") });
          const scelte = Array.isArray(b.ids) && b.ids.length
            ? tutte.filter((a) => b.ids!.includes(a.id))
            : tutte;
          if (!scelte.length) return json({ ok: true, quante: 0, gia: true });

          try {
            //  ⚠️ In ordine, e una alla volta: `attaccaAlLead` legge la scheda
            //   e la riscrive: in parallelo l'ultima scrittura cancellerebbe
            //   le precedenti, e ne arriverebbe una sola.
            for (const a of scelte) {
              await attaccaAlLead(leadId, {
                immagine: a.immagine, taglio: a.taglio, colore: a.colore,
                quando: a.quando, codice: scheda.codice,
              });
            }
            await segnaInviate(scelte.map((a) => a.id));
            //  Se il codice non era legato a nessuno, adesso lo è: la volta
            //  dopo non si richiede di cercare la stessa persona.
            if (!scheda.leadId && b.leadId) await aggiornaCodice(scheda.codice, { leadId });
            return json({ ok: true, quante: scelte.length });
          } catch (e) {
            return json({ ok: false, errore: String((e as Error).message || e) }, 502);
          }
        }
        /** ── ⚠️ DUE FORME DELLA STESSA IMMAGINE ──────────────────────────
         *  Prima qui arrivava sempre un file incorporato (`data:image/…`).
         *  Da quando ogni prova si salva da sola su Storage, quello che arriva
         *  è un INDIRIZZO — e il controllo, scritto quando l'altra forma non
         *  esisteva, lo rifiutava con «Immagine non valida»: il tasto «salva
         *  sulla scheda» rispondeva sempre di no.
         *  ⚠️ E un indirizzo NON si ricarica: è già su Storage, ricopiarlo
         *   vorrebbe dire due file identici per ogni salvataggio. */
        const immagine = String(b.immagine || "");
        const eIndirizzo = /^https?:\/\//.test(immagine);
        if (!eIndirizzo && !immagine.startsWith("data:image/")) {
          return json({ ok: false, errore: "Immagine non valida." }, 400);
        }

        try {
          const dove = eIndirizzo
            ? immagine
            : await salvaImmagine(`anteprima-${codice.replace(/[^A-Za-z0-9]/g, "")}`, immagine);
          const voce = {
            immagine: dove,
            taglio: String(b.taglio || ""),
            colore: String(b.colore || ""),
            quando: new Date().toISOString(),
            codice: scheda.codice,
          };

          //  ⚠️ Senza un lead collegato l'anteprima si salva lo stesso e resta
          //   attaccata al CODICE: il collegamento arriva quasi sempre dopo —
          //   quando quella persona paga, o quando la si ritrova in archivio —
          //   e buttarla adesso vorrebbe dire perderla proprio nel caso in cui
          //   serviva di più.
          if (!scheda.leadId) return json({ ok: true, dove, senzaLead: true });

          const db = supabaseAdmin as unknown as {
            from: (t: string) => {
              select: (c: string) => { eq: (a: string, b: string) => { limit: (n: number) => Promise<{ data?: { id: string; data?: Record<string, unknown> }[] }> } };
              update: (v: unknown) => { eq: (a: string, b: string) => Promise<unknown> };
            };
          };
          const r = await db.from("crm_leads").select("id, data").eq("id", scheda.leadId).limit(1);
          const lead = r.data?.[0];
          if (!lead) return json({ ok: true, dove, senzaLead: true });

          const prima = (lead.data ?? {}) as Record<string, unknown>;
          const dentro = (prima.provaCapelli as { anteprime?: unknown[] } | undefined)?.anteprime ?? [];
          const dopo = [voce, ...(Array.isArray(dentro) ? dentro : [])].slice(0, TETTO);
          await db.from("crm_leads").update({
            data: {
              ...prima,
              provaCapelli: { ...((prima.provaCapelli as Record<string, unknown>) ?? {}), anteprime: dopo },
            },
            updated_at: new Date().toISOString(),
          }).eq("id", lead.id);

          return json({ ok: true, dove, quante: dopo.length });
        } catch (e) {
          return json({ ok: false, errore: String((e as Error).message || e) }, 502);
        }
      },
    },
  },
});
