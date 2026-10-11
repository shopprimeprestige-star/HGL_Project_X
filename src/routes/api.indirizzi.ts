/** ── LA RICERCA DEGLI INDIRIZZI, DAL SERVITORE ─────────────────────────────
 *  GET  /api/indirizzi?q=via+degli+scipioni+roma   → IndirizzoScelto[]
 *  GET  /api/indirizzi?stato=1                     → { google: boolean }
 *  POST /api/indirizzi  { chiave }                 → salva o cancella la chiave
 *
 *  ── ⚠️ PERCHÉ PASSA DAL SERVITORE E NON DAL BROWSER ──────────────────────
 *  Una chiave di Google messa nel browser è una chiave PUBBLICA: chiunque apra
 *  gli strumenti per sviluppatori se la porta via, e da quel momento le
 *  chiamate le paga il proprietario dell'account. Google lo sa e per questo
 *  offre le restrizioni per referrer — che però si aggirano, e comunque
 *  vanno configurate a mano su ogni dominio da cui il CRM è raggiungibile.
 *  Qui la chiave sta in `app_config`, la legge solo il servitore, e il
 *  browser vede soltanto degli indirizzi. Se un domani la si vuole togliere,
 *  la si cancella da un posto solo.
 *
 *  ── ⚠️ E SE LA CHIAVE NON C'È, SI CONTINUA A FUNZIONARE ──────────────────
 *  Senza chiave si ripiega su Photon (OpenStreetMap), che è quello che il CRM
 *  usa da sempre. Un campo che smette di suggerire perché è scaduta una carta
 *  di credito sarebbe un difetto nato il giorno dell'attivazione.
 *
 *  ── ⚠️ SI USA «searchText» E NON «autocomplete» ──────────────────────────
 *  L'autocompletamento di Google restituisce delle PREVISIONI: del testo, con
 *  un identificativo. Per sapere CAP, comune e provincia serve una seconda
 *  chiamata per ognuna — cioè sei chiamate per una tendina di sei righe, e
 *  sei volte il prezzo. `places:searchText` con la maschera dei campi
 *  restituisce le componenti dell'indirizzo di tutti i risultati in UNA
 *  chiamata sola, ed è esattamente quello che serve a riempire i campi.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { cercaConPhoton, siglaProvincia, type IndirizzoScelto } from "@/crm/indirizzo-suggerito";

const CHIAVE = "google_places_key";

/** ⚠️ Il cast è lo stesso di crm/contabilita-fornitori e per lo stesso motivo:
 *  `app_config` non sta nei tipi generati di Supabase (è nata dopo l'ultima
 *  rigenerazione). Si descrive qui la sola catena di chiamate che serve invece
 *  di spegnere i tipi con `any` su tutto il file. */
const db = supabaseAdmin as unknown as {
  from(t: "app_config"): {
    select(c: string): {
      eq(k: string, v: string): { maybeSingle(): PromiseLike<{ data: { value?: string } | null }> };
    };
    upsert(riga: Record<string, unknown>, o: { onConflict: string }): PromiseLike<unknown>;
    delete(): { eq(k: string, v: string): PromiseLike<unknown> };
  };
};
const json = (o: unknown, stato = 200) =>
  new Response(JSON.stringify(o), {
    status: stato,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

async function chiaveSalvata(): Promise<string> {
  try {
    const { data } = await db.from("app_config").select("value").eq("key", CHIAVE).maybeSingle();
    const v = (data as { value?: string | null } | null)?.value;
    return typeof v === "string" ? v.trim() : "";
  } catch {
    return "";
  }
}

/** Una componente dell'indirizzo, per tipo. */
const pezzo = (
  comp: { longText?: string; shortText?: string; types?: string[] }[],
  tipo: string,
  corto = false,
): string => {
  const c = comp.find((x) => (x.types ?? []).includes(tipo));
  return (corto ? c?.shortText : c?.longText) ?? "";
};

async function cercaConGoogle(q: string, chiave: string): Promise<IndirizzoScelto[]> {
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": chiave,
      //  ⚠️ La maschera dei campi NON è facoltativa: senza, Google risponde
      //   400. Ed è anche quello che si paga — si chiede il minimo che serve.
      "X-Goog-FieldMask": "places.addressComponents,places.formattedAddress",
    },
    body: JSON.stringify({
      textQuery: q,
      languageCode: "it",
      regionCode: "IT",
      maxResultCount: 6,
    }),
  });
  if (!r.ok) throw new Error(`Google ha risposto ${r.status}`);
  const dati = (await r.json()) as {
    places?: {
      formattedAddress?: string;
      addressComponents?: { longText?: string; shortText?: string; types?: string[] }[];
    }[];
  };
  const fuori: IndirizzoScelto[] = [];
  for (const p of dati.places ?? []) {
    const comp = p.addressComponents ?? [];
    const via = pezzo(comp, "route");
    //  ⚠️ Senza una via non è un indirizzo: è una città, un monumento. In un
    //   campo «indirizzo del cliente» quelle sono rumore. Stessa regola di
    //   Photon, e sta scritta in tutte e due i posti perché sono due servizi.
    if (!via) continue;
    const comune =
      pezzo(comp, "locality") ||
      pezzo(comp, "postal_town") ||
      pezzo(comp, "administrative_area_level_3");
    const i: IndirizzoScelto = {
      indirizzo: via,
      civico: pezzo(comp, "street_number"),
      cap: pezzo(comp, "postal_code"),
      comune,
      //  Google la sigla ce l'ha già («RM»), ma non sempre: quando dà il nome
      //  per esteso si passa dalla stessa tabella di Photon.
      provincia:
        pezzo(comp, "administrative_area_level_2", true).length === 2
          ? pezzo(comp, "administrative_area_level_2", true).toUpperCase()
          : siglaProvincia(pezzo(comp, "administrative_area_level_2")),
      nazione: (pezzo(comp, "country", true) || "IT").toUpperCase(),
      esteso: "",
    };
    i.esteso =
      [
        [i.indirizzo, i.civico].filter(Boolean).join(" "),
        [i.cap, i.comune].filter(Boolean).join(" "),
        i.provincia,
      ]
        .filter(Boolean)
        .join(", ") ||
      (p.formattedAddress ?? "");
    if (!fuori.some((x) => x.esteso === i.esteso)) fuori.push(i);
  }
  return fuori;
}

export const Route = createFileRoute("/api/indirizzi")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const sp = new URL(request.url).searchParams;
        const chiave = await chiaveSalvata();
        //  A cosa serve: la schermata delle impostazioni deve poter dire se la
        //  chiave c'è, SENZA farsela restituire.
        if (sp.get("stato")) return json({ google: !!chiave });

        const q = (sp.get("q") ?? "").trim();
        if (q.length < 4) return json([]);
        if (chiave) {
          try {
            return json(await cercaConGoogle(q, chiave));
          } catch {
            /*  ⚠️ SI RIPIEGA INVECE DI FALLIRE. Quota finita, chiave revocata,
                Google che non risponde: al campo dell'indirizzo non deve
                importare. Meglio un suggerimento da OpenStreetMap che una
                tendina vuota mentre qualcuno sta scrivendo un indirizzo di
                spedizione. */
          }
        }
        try {
          return json(await cercaConPhoton(q));
        } catch {
          return json([]);
        }
      },

      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { chiave?: string };
        const v = String(body.chiave ?? "").trim();
        //  Stringa vuota = si toglie. Cancellare la riga invece di scriverne
        //  una vuota tiene `app_config` leggibile a occhio.
        if (!v) {
          await db.from("app_config").delete().eq("key", CHIAVE);
          return json({ ok: true, google: false });
        }
        await db
          .from("app_config")
          .upsert(
            { key: CHIAVE, value: v, updated_at: new Date().toISOString() },
            { onConflict: "key" },
          );
        return json({ ok: true, google: true });
      },
    },
  },
});
