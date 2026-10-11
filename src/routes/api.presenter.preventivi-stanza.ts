/** ── QUANTO FA IL PREVENTIVO DI CIASCUNO, IN UNA RISPOSTA SOLA ─────────────
 *
 *  Segnalazione del committente sul pannello «Cosa vede il cliente»: diceva
 *  chi vede cosa, ma non diceva MAI la cosa che si vuole sapere davvero —
 *  quanto fa quel preventivo, e se il cliente l'ha toccato. Per saperlo
 *  bisognava aprirlo, cioè smettere di fare quello che si stava facendo.
 *
 *  ⚠️ UNA RICHIESTA PER TUTTA LA STANZA, non una per persona: le righe stanno
 *   tutte in `app_config` e si leggono con una `in`. Il 27/09/2026 il sito si
 *   è fermato per il tetto giornaliero di richieste del piano, e da allora
 *   ogni giro nuovo si conta prima di scriverlo (vedi shop/stato-stanza).
 *  ⚠️ E NON ESCE NIENTE DEL CLIENTE: solo il totale, quante voci ha scelto e
 *   da quanto non si muove. Nome, telefono ed email stanno nella stessa riga e
 *   restano lì: questo riassunto lo legge il consulente, ma è comunque la
 *   regola giusta — un riassunto non ha bisogno dell'anagrafica. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chiaveSessione } from "@/shop/chiave-sessione";
import { stanzaDelPreventivo } from "@/shop/preventivi-di-gruppo";
import { chiaveAttesi, gettoneDi, leggiAttesi } from "@/crm/fascia-consulenza";
import { INTESTAZIONI_CONSENTITE, guardia } from "./api.presenter.consultant";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE };
const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** Il riassunto di un preventivo: quanto fa, quante voci, quando si è mosso. */
function riassuntoDi(grezzo: string | null | undefined, quando: string | null | undefined) {
  if (!grezzo) return null;
  try {
    const j = JSON.parse(grezzo) as {
      result?: { total?: unknown } | null;
      selected?: unknown[];
      baseId?: unknown;
      qty?: unknown;
    };
    const totale = Number(j?.result?.total);
    const voci = Array.isArray(j?.selected) ? j.selected.length : 0;
    //  «Toccato» = ha scelto una base o almeno una voce: un preventivo aperto
    //  e mai sfiorato non deve sembrare lavoro fatto.
    const toccato = !!j?.baseId || voci > 0;
    return {
      totale: Number.isFinite(totale) ? Math.round(totale) : null,
      voci,
      toccato,
      quando: quando ? new Date(quando).getTime() : 0,
    };
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/presenter/preventivi-stanza")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const no = await guardia(request, cors, { preventivi: {} });
        if (no) return no;
        const sess = new URL(request.url).searchParams.get("sess") || "";
        if (!sess) return json({ ok: true, preventivi: {} });
        const { data: righeAttesi } = await supabaseAdmin
          .from("app_config").select("value").eq("key", chiaveAttesi(sess)).maybeSingle();
        const persone = leggiAttesi((righeAttesi as { value?: string | null } | null)?.value);
        const perChiave = new Map<string, string>();   // chiave riga → gettone
        /*  ── ⚠️ ANCHE IL PREVENTIVO COMUNE, SEMPRE ────────────────────────
            Prima, senza attesi, si rispondeva «niente» e si usciva. Ma una
            consulenza aperta mandando il link non ha attesi: il cliente scrive
            il suo nome alla porta ed entra, e il suo preventivo è proprio
            quello comune. Il pannello chiedeva quanto fa e riceveva il vuoto —
            e restava senza la riga che serve sempre. Il comune sta sotto la
            chiave "" (nessun gettone), che è esattamente come lo chiama
            `stanzaDelPreventivo(sess, "")`. */
        perChiave.set(chiaveSessione("quote_state", stanzaDelPreventivo(sess, "")), "");
        for (const p of persone) {
          const g = gettoneDi(p);
          if (g) perChiave.set(chiaveSessione("quote_state", stanzaDelPreventivo(sess, g)), g);
        }
        const { data: righe } = await supabaseAdmin
          .from("app_config").select("key,value,updated_at").in("key", [...perChiave.keys()]);
        const out: Record<string, unknown> = {};
        for (const r of (righe as { key: string; value?: string | null; updated_at?: string | null }[] | null) ?? []) {
          const g = perChiave.get(r.key);
          const s = riassuntoDi(r.value, r.updated_at);
          //  ⚠️ `g` può essere "" — il comune — e "" è falso: si controlla che
          //   la chiave ci SIA, non che sia piena. È la riga che fa sparire il
          //   riassunto proprio nel caso nuovo.
          if (g !== undefined && s) out[g] = s;
        }
        return json({ ok: true, preventivi: out });
      },
    },
  },
});
