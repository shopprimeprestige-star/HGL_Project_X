/** Archivio registrazioni delle videochiamate, per presentatore.
 *  GET ?presenterId=... -> { recordings: [...] }  (senza filtro = tutte)
 *  POST {presenterId, presenterName, url, date, duration, guestName, quoteRef?}
 *  GET ?quoteRef=ID8271X -> solo le registrazioni di quel preventivo
 *  DELETE ?id=...
 *  Salvate in app_config.key = 'recordings' via service role.
 *
 *  ── SOLO A CHI HA L'ACCESSO ───────────────────────────────────────────────
 *  Qui dentro ci sono i collegamenti ai VIDEO delle consulenze: persone vere che
 *  parlano della propria salute, col loro nome accanto. Era l'archivio più
 *  delicato dell'applicazione e rispondeva a chiunque conoscesse l'indirizzo.
 *  Adesso serve una sessione da presentatore OPPURE l'accesso al CRM col
 *  permesso «preventivi», verificati sul server contro il database (vedi
 *  api.presenter.consultant e api.crm.accesso): senza, 401 e nessun dato.
 *  Le due porte le apre `chiGuarda`, più sotto, che dice anche fin dove.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  INTESTAZIONI_CONSENTITE,
  accessoPresentatore,
  autorizzaPresentatore,
  guardia,
  guardiaP,
  nonAutorizzato,
} from "./api.presenter.consultant";
import { guardiaCRM } from "./api.crm.accesso";

//  Due porte, due credenziali: quelle del CRM (`Authorization` per l'accesso
//  titolare, `x-crm-token` per chi è entrato col PIN) vanno dichiarate qui, o il
//  browser non le lascia nemmeno partire quando la chiamata arriva da un'altra
//  origine. Come in api.presenter.quote-owner.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": `${INTESTAZIONI_CONSENTITE}, Authorization, x-crm-token`,
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

interface Rec {
  id: string; presenterId: string; presenterName: string;
  url: string; date: string; duration: number; guestName: string;
  /** preventivo aperto quando la registrazione è stata chiusa: è ciò che lega
   *  il video alla trattativa, in entrambe le direzioni. */
  quoteRef?: string;
  /** ── ⚠️ IL CLIENTE CHE SI AVEVA DAVANTI ────────────────────────────────
   *  Segnalazione del committente: «non salva le registrazioni dentro al CRM».
   *  Il video si salvava, ma l'unico filo era `quoteRef`: in una consulenza
   *  senza preventivo non restava niente, e nel CRM alle registrazioni si
   *  arriva SOLO passando da un preventivo. Il lead c'è anche quando il
   *  preventivo non si fa — lo scrive il CRM aprendo la stanza — ed è quello
   *  che rende la scheda del cliente capace di mostrarle (vedi
   *  crm/registrazioni-del-lead). Assente sulle registrazioni di prima. */
  leadId?: string;
}

async function readList(): Promise<Rec[]> {
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", "recordings").maybeSingle();
  try { return (JSON.parse((data as { value?: string } | null)?.value ?? "[]") as Rec[]) || []; } catch { return []; }
}
async function writeList(list: Rec[]) {
  await supabaseAdmin.from("app_config").upsert(
    { key: "recordings", value: JSON.stringify(list), updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
}

/** ── CHI STA GUARDANDO, E FIN DOVE ─────────────────────────────────────────
 *  Due porte, una risposta sola: l'id di chi chiede e se può vedere anche le
 *  registrazioni dei colleghi.
 *
 *  ⚠️ LA SECONDA PORTA È IL CRM, e mancava. Questa rotta chiedeva solo la
 *   sessione del PRESENTATORE — cookie `hg_psess` o `x-presenter-token` — che
 *   da /CRM/preventivi non esiste e non si può ottenere: la pagina prendeva 401
 *   a ogni apertura e la voce «La registrazione della consulenza» nel menu «…»
 *   non poteva comparire mai, su nessuna riga. Non un errore a schermo: una
 *   funzione che semplicemente non c'era. È lo stesso anello già chiuso su
 *   api.presenter.quote-owner e su api.presenter.quote-edit.
 *
 *  ⚠️ IL PERMESSO CHE ALLARGA È LO STESSO DELLE DUE PORTE — `registrazioni.tutte`
 *   — perché il PIN è lo stesso e i mestieri sono gli stessi (crm/permessi): chi
 *   dal pannello del presentatore vede solo le proprie consulenze non deve
 *   vederle tutte passando dal CRM. Il permesso per ENTRARE è «preventivi», lo
 *   stesso che serve per aprire la pagina da cui si chiede.
 *
 *  ⚠️ Non si tocca il database quando la richiesta non porta credenziali CRM:
 *   il caso frequente resta il presentatore, e non deve pagare la seconda porta. */
const bussaDalCRM = (request: Request): boolean =>
  !!request.headers.get("x-crm-token") || !!request.headers.get("authorization");

async function chiGuarda(request: Request): Promise<{ id: string; tutte: boolean } | null> {
  const p = await autorizzaPresentatore(request);
  if (p) {
    const accesso = await accessoPresentatore(p);
    return { id: p.id, tutte: accesso.puo("registrazioni.tutte") };
  }
  if (!bussaDalCRM(request)) return null;
  const g = await guardiaCRM(request, cors, "preventivi");
  //  `consultantId` è vuoto per chi entra con email e password: è il
  //  proprietario, che ha accesso pieno e quindi non passa mai dal filtro «solo
  //  le mie». Un id vuoto qui non può quindi nascondere tutto a nessuno.
  return g.ok ? { id: g.chi.consultantId, tutte: g.chi.accesso.puo("registrazioni.tutte") } : null;
}

export const Route = createFileRoute("/api/presenter/recordings")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        // `recordings` e `refs` vuoti tengono la forma che il pannello si
        // aspetta: una sessione scaduta lo lascia vuoto invece di romperlo.
        const chi = await chiGuarda(request);
        if (!chi) return nonAutorizzato(cors, { recordings: [], refs: [], leads: [] });

        //  ── LE PROPRIE, NON QUELLE DEGLI ALTRI ──────────────────────────
        //  Qui dentro ci sono i video di persone vere che parlano della propria
        //  salute. Un consulente standard rivede le SUE consulenze; le altrui
        //  non gli servono per lavorare, e non è un filtro dell'interfaccia —
        //  è questa riga, prima che l'elenco esca dal server.
        const tutte = chi.tutte;

        const sp = new URL(request.url).searchParams;
        const pid = sp.get("presenterId");
        const ref = (sp.get("quoteRef") || "").trim().toUpperCase();
        const lead = (sp.get("leadId") || "").trim();
        const completo = await readList();
        //  Il filtro dei permessi si applica PRIMA di quello richiesto: chiedere
        //  `?presenterId=<un collega>` non deve poter allargare il proprio
        //  elenco, solo restringerlo.
        const visibili = tutte ? completo : completo.filter((r) => r.presenterId === chi.id);
        let list = visibili;
        if (pid) list = list.filter((r) => r.presenterId === pid);
        if (ref) list = list.filter((r) => (r.quoteRef || "").toUpperCase() === ref);
        if (lead) list = list.filter((r) => (r.leadId || "") === lead);
        // elenco dei preventivi che HANNO una registrazione: serve al pannello
        // per accendere il pulsante solo dove c'è davvero qualcosa da vedere
        const refs = [...new Set(visibili.map((r) => (r.quoteRef || "").toUpperCase()).filter(Boolean))];
        //  Gli stessi accendi-e-spegni per le SCHEDE dei clienti: senza, la
        //  scheda dovrebbe chiedere «hai qualcosa per me?» una per una.
        const leads = [...new Set(visibili.map((r) => r.leadId || "").filter(Boolean))];
        return json({ recordings: list, refs, leads });
      },
      POST: async ({ request }) => {
        //  L'archivio si riempie SOLO dal dispositivo del presentatore, a fine
        //  registrazione: lì la sessione c'è sempre (link magico o PIN). Senza
        //  questo controllo, chiunque poteva riempirlo di voci finte finché le
        //  registrazioni vere non uscivano dal tetto delle 500.
        const no = await guardia(request, cors);
        if (no) return no;
        let body: Partial<Rec> = {};
        try { body = (await request.json()) as Partial<Rec>; } catch { /* ignore */ }
        if (!body.url) return json({ ok: false, reason: "missing_url" }, 400);
        const list = await readList();
        list.unshift({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          presenterId: body.presenterId || "",
          presenterName: body.presenterName || "",
          url: body.url,
          date: body.date || new Date().toISOString(),
          duration: Number(body.duration) || 0,
          guestName: body.guestName || "",
          quoteRef: (body.quoteRef || "").trim().toUpperCase() || undefined,
          leadId: (body.leadId || "").trim() || undefined,
        });
        await writeList(list.slice(0, 500)); // tetto di sicurezza
        return json({ ok: true, recordings: list });
      },
      DELETE: async ({ request }) => {
        //  Cancellare è irreversibile e la registrazione può essere di un
        //  collega: è la stessa chiave che permette di vederle tutte.
        const no = await guardiaP(request, cors, "registrazioni.tutte");
        if (no) return no;
        const id = new URL(request.url).searchParams.get("id") || "";
        const list = (await readList()).filter((r) => r.id !== id);
        await writeList(list);
        return json({ ok: true, recordings: list });
      },
    },
  },
});
