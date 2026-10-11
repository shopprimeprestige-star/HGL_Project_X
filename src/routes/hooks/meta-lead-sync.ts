/** ─────────────────────────────────────────────────────────────────────────
 *  RECUPERO PERIODICO DEI LEAD DEI MODULI META
 *
 *  A COSA SERVE
 *  Il webhook (`/api/public/meta-leadgen-webhook`) porta dentro il lead nel
 *  momento in cui viene compilato, ma ha due difetti che si pagano cari: va
 *  configurato dentro un'app Meta con tanto di sottoscrizione della Pagina, e
 *  quando non parte — app in revisione, token scaduto, un nostro deploy nel
 *  momento sbagliato — quel lead non arriva MAI PIÙ, perché Meta non ritenta
 *  all'infinito. Qui invece si va a vedere: ogni pochi minuti si chiede alla
 *  Graph API l'elenco dei lead degli ultimi giorni e si scrive quello che non
 *  c'è ancora.
 *
 *  Le due strade convivono senza pestarsi i piedi: scrivono la stessa riga
 *  (`crm/meta-leadgen.ts`) e si riconoscono per `external_id`, quindi il lead
 *  già preso dal webhook qui viene saltato. Se il webhook non esiste, questo
 *  basta da solo — è la ragione per cui è stato chiesto.
 *
 *  COME LO SI CHIAMA
 *  POST /hooks/meta-lead-sync, con l'intestazione Authorization che porta la
 *  chiave pubblicabile di Supabase: è lo stesso giro degli altri hook di questa
 *  cartella, chiamati da pg_cron (vedi la migrazione `meta_lead_sync_cron`).
 *  Corpo facoltativo: { giorni?: number, prova?: true }.
 *   · `giorni` — quanto indietro guardare (di serie 3, massimo 90). Serve al
 *     primo giro, per tirare dentro i lead già raccolti prima di oggi.
 *   · `prova` — conta e basta, non scrive niente: il pulsante «Prova la
 *     connessione» delle impostazioni la usa per dire se i permessi vanno bene
 *     senza riempire il CRM di contatti.
 *
 *  ⚠️ COSA SERVE SU META (e senza cosa questo non trova niente)
 *   Un token della Pagina con il permesso `leads_retrieval`, e la Pagina come
 *   asset dell'utente di sistema che lo ha generato. NON serve né il webhook né
 *   l'app in modalità Live: è la differenza pratica fra le due strade.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { idEsterno, schedaDaLead, soloNuovi, type LeadMeta } from "@/crm/meta-leadgen";

const META_API = "https://graph.facebook.com/v21.0";

/** Quanto indietro si guarda, se nessuno lo dice. Tre giorni coprono un
 *  weekend di fermo senza chiedere a Meta mezzo anno di storia a ogni giro. */
const GIORNI_DI_SERIE = 3;
/** Tetti di sicurezza: un modulo con migliaia di lead non deve poter far
 *  girare questa funzione per minuti a ogni passata. */
const MAX_PAGINE_MODULI = 5;
const MAX_PAGINE_LEAD = 10;
const CAMPI_LEAD =
  "id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

interface Config {
  user_id: string;
  meta_page_id: string | null;
  meta_page_access_token: string | null;
}

interface RispostaGraph<T> {
  data?: T[];
  paging?: { next?: string };
  error?: { message?: string; type?: string; code?: number };
}

/** Una chiamata alla Graph API che non fa finta di essere andata bene.
 *  ⚠️ Meta risponde 200 con dentro `error` più spesso di quanto risponda un
 *   codice d'errore: leggere solo `res.ok` vuol dire un recupero che dice
 *   «zero lead» quando in realtà il token è scaduto. */
async function chiedi<T>(url: string): Promise<{ righe: T[]; prossima?: string; errore?: string }> {
  const res = await fetch(url);
  let body: RispostaGraph<T>;
  try {
    body = (await res.json()) as RispostaGraph<T>;
  } catch {
    return { righe: [], errore: `risposta illeggibile (${res.status})` };
  }
  if (body.error?.message) return { righe: [], errore: body.error.message };
  if (!res.ok) return { righe: [], errore: `Graph API ${res.status}` };
  return { righe: body.data ?? [], prossima: body.paging?.next };
}

/** Tutti i moduli della Pagina. Non si chiede all'utente di elencarli: i
 *  moduli si creano e si archiviano di continuo, e un elenco scritto a mano
 *  invecchia il giorno dopo. */
async function moduliDellaPagina(pageId: string, token: string) {
  const out: { id: string; name?: string }[] = [];
  let url = `${META_API}/${pageId}/leadgen_forms?fields=id,name&limit=50&access_token=${encodeURIComponent(token)}`;
  for (let i = 0; i < MAX_PAGINE_MODULI && url; i++) {
    const r = await chiedi<{ id: string; name?: string }>(url);
    if (r.errore) return { moduli: out, errore: r.errore };
    out.push(...r.righe);
    url = r.prossima ?? "";
  }
  return { moduli: out, errore: undefined as string | undefined };
}

/** I lead di un modulo, da `da` (secondi unix) in avanti.
 *  Il filtro lo applica Meta: chiedere tutto e scartare qui vorrebbe dire
 *  scaricare la storia intera del modulo a ogni passata. */
async function leadDelModulo(formId: string, token: string, da: number) {
  const filtro = encodeURIComponent(
    JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: da }]),
  );
  const out: LeadMeta[] = [];
  let url = `${META_API}/${formId}/leads?fields=${CAMPI_LEAD}&limit=100&filtering=${filtro}&access_token=${encodeURIComponent(token)}`;
  for (let i = 0; i < MAX_PAGINE_LEAD && url; i++) {
    const r = await chiedi<LeadMeta>(url);
    if (r.errore) return { lead: out, errore: r.errore };
    out.push(...r.righe);
    url = r.prossima ?? "";
  }
  return { lead: out, errore: undefined as string | undefined };
}

/** ── LA TABELLA CHE I TIPI GENERATI NON DESCRIVONO PER LA SCRITTURA ───────
 *  `public_leads` c'è nei tipi in lettura, ma l'inserimento di una riga
 *  costruita a mano non passa il controllo (le colonne obbligatorie le
 *  riempie `schedaDaLead`). Qui la porta è una sola e dichiara le due
 *  operazioni che servono. */
type ErroreDb = { message: string } | null;
const tabella = (nome: string) =>
  (supabaseAdmin as unknown as {
    from: (t: string) => {
      insert: (v: Record<string, unknown>[]) => PromiseLike<{ error: ErroreDb }>;
      select: (c: string) => {
        in: (col: string, vals: string[]) => PromiseLike<{ data: { external_id: string }[] | null }>;
        eq: (col: string, v: string) => { maybeSingle: () => PromiseLike<{ data: { value?: string | null } | null }> };
      };
      upsert: (v: Record<string, unknown>, o: { onConflict: string }) => PromiseLike<{ error: ErroreDb }>;
    };
  }).from(nome);

/** Quali di questi lead sono già dentro. Si chiede al database invece di
 *  tenere un segnalibro dell'ultimo giro: un segnalibro sbagliato salta dei
 *  lead per sempre, questo confronto al massimo fa una domanda in più. */
async function giaDentro(ids: string[]): Promise<Set<string>> {
  const dentro = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const pezzo = ids.slice(i, i + 100);
    const { data } = await tabella("public_leads").select("external_id").in("external_id", pezzo);
    for (const r of data ?? []) if (r.external_id) dentro.add(r.external_id);
  }
  return dentro;
}

/** L'esito dell'ultimo giro, perché le impostazioni possano dirlo a parole.
 *  Un recupero che gira di notte e non lascia traccia è un recupero di cui
 *  nessuno può dire se funziona. */
async function segnaEsito(esito: unknown) {
  await tabella("app_config").upsert(
    { key: "meta_lead_sync", value: JSON.stringify(esito), updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
}

export const Route = createFileRoute("/hooks/meta-lead-sync")({
  server: {
    handlers: {
      /** L'esito dell'ultimo giro, per le impostazioni.
       *  ⚠️ Passa da qui e non dal browser perché `app_config` non è leggibile
       *   con la chiave pubblica: è la stessa riga da cui il preventivo legge i
       *   prezzi, e aprirla al browser aprirebbe anche quelli. */
      GET: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const attesa = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!auth || !auth.includes(attesa || "__mancante__")) return json({ error: "unauthorized" }, 401);
        const { data } = await tabella("app_config").select("value").eq("key", "meta_lead_sync").maybeSingle();
        try {
          const v = (data as { value?: string | null } | null)?.value;
          return json({ ok: true, ultimo: v ? JSON.parse(v) : null });
        } catch {
          return json({ ok: true, ultimo: null });
        }
      },

      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const attesa = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!auth || !auth.includes(attesa || "__mancante__")) return json({ error: "unauthorized" }, 401);

        let giorni = GIORNI_DI_SERIE;
        let prova = false;
        try {
          const txt = await request.text();
          if (txt) {
            const b = JSON.parse(txt) as { giorni?: number; prova?: boolean };
            if (Number.isFinite(b.giorni)) giorni = Math.min(90, Math.max(1, Number(b.giorni)));
            prova = b.prova === true;
          }
        } catch {
          /* nessun corpo: valgono i valori di serie */
        }
        const da = Math.floor(Date.now() / 1000) - giorni * 86400;

        const { data: configs } = await supabaseAdmin
          .from("tracking_config")
          .select("user_id, meta_page_id, meta_page_access_token")
          .not("meta_page_id", "is", null)
          .not("meta_page_access_token", "is", null);

        const elenco = (configs ?? []) as unknown as Config[];
        if (elenco.length === 0) {
          const esito = {
            quando: new Date().toISOString(),
            configurato: false,
            errore: "Manca la Pagina o il token: CRM → Impostazioni → Meta Lead Ads",
          };
          if (!prova) await segnaEsito(esito);
          return json({ ok: true, ...esito, risultati: [] });
        }

        const risultati: Record<string, unknown>[] = [];
        let nuoviTotali = 0;

        for (const cfg of elenco) {
          const pageId = cfg.meta_page_id ?? "";
          const token = cfg.meta_page_access_token ?? "";
          try {
            const { moduli, errore } = await moduliDellaPagina(pageId, token);
            if (errore) {
              risultati.push({ user_id: cfg.user_id, moduli: 0, trovati: 0, nuovi: 0, errore });
              continue;
            }
            const trovati: LeadMeta[] = [];
            let erroreLead: string | undefined;
            for (const m of moduli) {
              const r = await leadDelModulo(m.id, token, da);
              if (r.errore) {
                erroreLead = `modulo ${m.name ?? m.id}: ${r.errore}`;
                break;
              }
              trovati.push(...r.lead);
            }
            if (erroreLead) {
              risultati.push({ user_id: cfg.user_id, moduli: moduli.length, trovati: trovati.length, nuovi: 0, errore: erroreLead });
              continue;
            }

            const dentro = await giaDentro(trovati.map((l) => idEsterno(l.id)));
            const nuovi = soloNuovi(trovati, dentro);

            if (!prova && nuovi.length) {
              //  ⚠️ A blocchi, e un blocco che fallisce non ferma gli altri: un
              //   solo lead storto non deve poter trattenere fuori tutti quelli
              //   arrivati insieme a lui.
              for (let i = 0; i < nuovi.length; i += 50) {
                const righe = nuovi.slice(i, i + 50).map((l) => schedaDaLead(l));
                const { error } = await tabella("public_leads").insert(righe);
                if (error) {
                  erroreLead = `scrittura fallita: ${error.message}`;
                  break;
                }
              }
            }
            if (!prova && !erroreLead) nuoviTotali += nuovi.length;
            risultati.push({
              user_id: cfg.user_id,
              moduli: moduli.length,
              trovati: trovati.length,
              nuovi: nuovi.length,
              ...(erroreLead ? { errore: erroreLead } : {}),
            });
          } catch (e) {
            risultati.push({
              user_id: cfg.user_id,
              moduli: 0,
              trovati: 0,
              nuovi: 0,
              errore: e instanceof Error ? e.message : String(e),
            });
          }
        }

        const primoErrore = risultati.find((r) => r.errore)?.errore as string | undefined;
        const esito = {
          quando: new Date().toISOString(),
          configurato: true,
          giorni,
          prova,
          nuovi: nuoviTotali,
          trovati: risultati.reduce((s, r) => s + (Number(r.trovati) || 0), 0),
          moduli: risultati.reduce((s, r) => s + (Number(r.moduli) || 0), 0),
          ...(primoErrore ? { errore: primoErrore } : {}),
        };
        if (!prova) await segnaEsito(esito);
        return json({ ok: !primoErrore, ...esito, risultati });
      },
    },
  },
});
