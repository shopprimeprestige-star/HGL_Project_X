/** ── COMPRARE ALTRE PROVE ──────────────────────────────────────────────────
 *
 *  POST { codice, pacchetto, nome, cognome, email, telefono }
 *    → apre un pagamento su SumUp e restituisce dove mandare la persona.
 *  GET  ?ordine=…
 *    → chiede a SumUp com'è andata; se è pagato accredita le prove, aggiorna
 *      il lead e chiude l'ordine.
 *
 *  ── ⚠️ LE PROVE SI ACCREDITANO SOLO SU RISPOSTA DI SUMUP ─────────────────
 *  Non quando la persona torna sul sito: l'indirizzo di ritorno lo può aprire
 *  chiunque, e regalerebbe cinquanta prove a chi lo indovina.
 *
 *  ── ⚠️ E UNA VOLTA SOLA ──────────────────────────────────────────────────
 *  La pagina di ritorno si ricarica, si riapre dalla cronologia, si torna
 *  indietro col tasto del browser. Ogni volta ripasserebbe di qui: l'ordine
 *  che passa a «pagato» è il lucchetto che impedisce di accreditare due volte.
 */
import { createFileRoute } from "@tanstack/react-router";
import { aggiornaCodice, aggiornaOrdine, aggiungiProve, creaOrdine, trovaCodice, trovaOrdine } from "@/prova/archivio.server";
import { formaValida, normalizza } from "@/prova/codici";
import { inEuro, pacchettoDa } from "@/prova/pacchetti";
import { creaCheckout, statoCheckout } from "@/prova/sumup.server";
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

/** ── IL LEAD SI AGGIORNA, NON SE NE CREA UN ALTRO ──────────────────────────
 *  Chi paga quasi sempre è già in archivio: ha chiesto informazioni, gli
 *  abbiamo mandato il codice. Creargli una scheda nuova vorrebbe dire due
 *  schede della stessa persona, e due persone che la chiamano.
 *  ⚠️ Si cerca prima per TELEFONO e poi per email: il telefono è il campo su
 *   cui questo studio lavora davvero, ed è quello che la gente scrive giusto.
 *  ⚠️ E se non c'è nessuno, si crea: chi ha pagato deve esistere in archivio
 *   comunque, altrimenti l'incasso non si lega a nessuno. */
async function segnaSulLead(o: {
  leadId?: string; nome?: string; cognome?: string; email?: string; telefono?: string;
  centesimi: number; prove: number;
}): Promise<string | null> {
  const db = supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (a: string, b: string) => { limit: (n: number) => Promise<{ data?: { id: string; data?: Record<string, unknown> }[] }> };
        or: (q: string) => { limit: (n: number) => Promise<{ data?: { id: string; data?: Record<string, unknown> }[] }> };
      };
      update: (v: unknown) => { eq: (a: string, b: string) => Promise<unknown> };
      insert: (v: unknown) => { select: (c: string) => Promise<{ data?: { id: string }[] }> };
    };
  };
  const tel = String(o.telefono || "").replace(/[^\d+]/g, "");
  try {
    let trovato: { id: string; data?: Record<string, unknown> } | null = null;
    if (o.leadId) {
      const r = await db.from("crm_leads").select("id, data").eq("id", o.leadId).limit(1);
      trovato = r.data?.[0] ?? null;
    }
    if (!trovato && (tel || o.email)) {
      const pezzi = [
        ...(tel ? [`data->>telefono.ilike.%${tel.slice(-9)}%`] : []),
        ...(o.email ? [`data->>email.ilike.${o.email}`] : []),
      ];
      const r = await db.from("crm_leads").select("id, data").or(pezzi.join(",")).limit(1);
      trovato = r.data?.[0] ?? null;
    }

    //  Quello che si scrive sulla scheda: che ha pagato, quanto, e per cosa.
    //  ⚠️ Si SOMMA agli acquisti precedenti: un cliente che compra due volte
    //   deve risultare per quello che ha speso in tutto, non per l'ultima
    //   volta — quel numero lo guarda chi decide chi richiamare.
    const prima = (trovato?.data ?? {}) as Record<string, unknown>;
    const spesoPrima = Number((prima.provaCapelli as { spesoCentesimi?: number } | undefined)?.spesoCentesimi || 0);
    const dati = {
      ...prima,
      ...(o.nome && !prima.nome ? { nome: o.nome } : {}),
      ...(o.cognome && !prima.cognome ? { cognome: o.cognome } : {}),
      ...(o.email && !prima.email ? { email: o.email } : {}),
      ...(tel && !prima.telefono ? { telefono: tel } : {}),
      provaCapelli: {
        ...((prima.provaCapelli as Record<string, unknown>) ?? {}),
        haPagato: true,
        spesoCentesimi: spesoPrima + o.centesimi,
        proveComprate:
          Number((prima.provaCapelli as { proveComprate?: number } | undefined)?.proveComprate || 0) + o.prove,
        ultimoAcquisto: new Date().toISOString(),
      },
    };

    if (trovato) {
      await db.from("crm_leads").update({ data: dati, updated_at: new Date().toISOString() }).eq("id", trovato.id);
      return trovato.id;
    }
    const creato = await db.from("crm_leads")
      .insert({ data: { ...dati, stato: "da_contattare", createdAt: new Date().toISOString() } })
      .select("id");
    return creato.data?.[0]?.id ?? null;
  } catch {
    //  ⚠️ Un intoppo sull'archivio NON deve far fallire un pagamento riuscito:
    //   i soldi sono arrivati, le prove vanno date. La scheda si sistema dopo,
    //   e l'ordine resta scritto con tutti i dati per rifarlo a mano.
    return null;
  }
}

export const Route = createFileRoute("/api/public/prova-acquisto")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        let b: {
          codice?: string; pacchetto?: string;
          nome?: string; cognome?: string; email?: string; telefono?: string;
        };
        try { b = (await request.json()) as typeof b; } catch { return json({ ok: false, errore: "richiesta illeggibile" }, 400); }

        const codice = String(b.codice || "");
        if (!formaValida(codice)) return json({ ok: false, errore: "Serve il tuo codice." }, 400);
        const scheda = await trovaCodice(codice);
        if (!scheda) return json({ ok: false, errore: "Questo codice non esiste." }, 404);

        const p = pacchettoDa(String(b.pacchetto || ""));
        if (!p) return json({ ok: false, errore: "Pacchetto non riconosciuto." }, 400);

        //  ⚠️ I quattro dati si chiedono TUTTI, e non è burocrazia: senza
        //   telefono ed email un incasso non si lega a nessuno, e chi ha
        //   pagato resta un importo senza nome sul conto.
        const nome = String(b.nome || "").trim();
        const cognome = String(b.cognome || "").trim();
        const email = String(b.email || "").trim();
        const telefono = String(b.telefono || "").trim();
        if (!nome || !cognome) return json({ ok: false, errore: "Servono nome e cognome." }, 400);
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return json({ ok: false, errore: "L'email non sembra giusta." }, 400);
        if (telefono.replace(/[^\d]/g, "").length < 8) return json({ ok: false, errore: "Il numero non sembra giusto." }, 400);

        const id = `HG${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
        const origine = new URL(request.url).origin;
        try {
          const checkout = await creaCheckout({
            riferimento: id,
            centesimi: p.centesimi,
            descrizione: `${p.nome} — prova capelli Hair Genius Labs`,
            email,
            ritorno: `${origine}/prova-capelli?ordine=${encodeURIComponent(id)}`,
          });
          await creaOrdine({
            id,
            quando: new Date().toISOString(),
            codice: normalizza(codice),
            pacchetto: p.chiave,
            prove: p.prove,
            centesimi: p.centesimi,
            stato: "in-attesa",
            nome, cognome, email, telefono,
            ...(scheda.leadId ? { leadId: scheda.leadId } : {}),
            riferimento: checkout.id,
          });
          return json({ ok: true, ordine: id, dove: checkout.dove });
        } catch (e) {
          return json({ ok: false, errore: String((e as Error).message || e) }, 502);
        }
      },

      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get("ordine") || "";
        const o = id ? await trovaOrdine(id) : null;
        if (!o) return json({ ok: false, errore: "Ordine non trovato." }, 404);
        //  Già chiuso: si risponde con quello che c'è, senza accreditare di
        //  nuovo. È il lucchetto contro la pagina ricaricata.
        if (o.stato === "pagato") return json({ ok: true, stato: "pagato", prove: o.prove, gia: true });

        const esito = await statoCheckout(String(o.riferimento || ""));
        if (!esito.pagato) return json({ ok: true, stato: esito.stato, prove: 0 });

        await aggiungiProve(o.codice, o.prove);
        const leadId = await segnaSulLead({
          leadId: o.leadId, nome: o.nome, cognome: o.cognome, email: o.email, telefono: o.telefono,
          centesimi: o.centesimi, prove: o.prove,
        });
        //  Il codice si porta dietro i dati di chi ha pagato: la volta dopo il
        //  modulo è già pieno, e un modulo già pieno si conferma invece di
        //  compilarlo.
        await aggiornaCodice(o.codice, {
          ...(leadId ? { leadId } : {}),
          ...(o.nome ? { nome: o.nome } : {}),
          ...(o.cognome ? { cognome: o.cognome } : {}),
          ...(o.email ? { email: o.email } : {}),
          ...(o.telefono ? { telefono: o.telefono } : {}),
        });
        await aggiornaOrdine(o.id, { stato: "pagato", ...(leadId ? { leadId } : {}) });

        return json({ ok: true, stato: "pagato", prove: o.prove, quanto: inEuro(o.centesimi) });
      },
    },
  },
});
