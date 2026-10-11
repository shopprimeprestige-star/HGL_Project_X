/** MODIFICHE A UN PREVENTIVO GIÀ CREATO ────────────────────────────────────
 *  Qui si conservano le cose che si affiancano a un preventivo senza cambiarne
 *  il prezzo: la nuova scadenza delle condizioni e le note di consulenza.
 *
 *  ── ⚠️ QUESTA NON È PIÙ LA STRADA PER CAMBIARE UN PREZZO ──────────────────
 *  Lo è stata, ed è costato caro. Sconto, quantità e codici finivano qui
 *  accanto alla riga, e il prezzo vero si otteneva sommando riga + modifica al
 *  momento della lettura: sulla pagina il prezzo vecchio lampeggiava prima di
 *  quello nuovo, e l'anteprima di WhatsApp — che si disegna fuori dal browser,
 *  dove quella somma non avviene mai — mostrava il prezzo pieno al cliente.
 *  Da oggi una modifica commerciale fa NASCERE UN PREVENTIVO NUOVO, con i
 *  valori già dentro la riga: vedi api.presenter.quote-revise. Quello che resta
 *  qui si legge ancora — i preventivi ritoccati prima di questo cambiamento
 *  hanno la loro modifica scritta qui e devono continuare a mostrarla — ma
 *  scriverci un prezzo nuovo rimetterebbe in piedi il guasto.
 *
 *  GET  ?ref=ID8271X                 -> { edit: {...} | null }   (anche al cliente)
 *  GET  ?refs=A,B,C                  -> { edits: {...} }         (presentatore o CRM)
 *  POST { ref, code, qty?, extraEur?, promoDays?, note? } -> { ok, edit }
 *         `code` = PIN del presentatore OPPURE codice consulente. Senza, nessuna
 *         modifica. In `edit.by` finisce il nome di chi ha modificato.
 *  app_config.key = 'quote_edit:<REF>'
 *
 *  ── CHE COSA VEDE IL CLIENTE ──────────────────────────────────────────────
 *  La pagina del preventivo gira anche sul telefono del cliente, e ogni pochi
 *  secondi rilegge questa rotta per aggiornare prezzo e scadenza in diretta:
 *  la lettura di UN preventivo resta quindi aperta. Ma dentro le modifiche ci
 *  sono anche le note interne — allergie, accordi presi, cosa ricordare — e
 *  quelle uscivano insieme al resto anche verso chi non doveva leggerle.
 *  Da qui in poi escono SOLO a chi è dello studio — la sessione da presentatore
 *  oppure il CRM col permesso «preventivi» (vedi `leggeTutto`); a tutti gli
 *  altri arrivano quantità, sconti e scadenza, cioè quello che serve davvero a
 *  mostrare il preventivo aggiornato.
 *
 *  Il codice consulente non è più scritto in questo file: vive nella variabile
 *  d'ambiente PRESENTER_CONSULTANT_CODE o in app_config (api.presenter.consultant).
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  INTESTAZIONI_CONSENTITE,
  accessoPresentatore,
  autorizzaPresentatore,
  nonAutorizzato,
  vietatoP,
  sessioneDaRichiesta,
} from "./api.presenter.consultant";
import { guardiaCRM } from "./api.crm.accesso";

//  Due porte, due credenziali: quelle del CRM (`Authorization` per l'accesso
//  titolare, `x-crm-token` per chi è entrato col PIN) vanno dichiarate qui, o il
//  browser non le lascia nemmeno partire quando la chiamata arriva da un'altra
//  origine. Come in api.presenter.quote-owner.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": `${INTESTAZIONI_CONSENTITE}, Authorization, x-crm-token`,
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

export interface QuoteEdit {
  qty?: number;
  /** sconto aggiuntivo riapplicato dal consulente (€) */
  extraEur?: number;
  /** codici sconto aggiunti dopo la creazione, con il valore validato dal server */
  codes?: { code: string; eur: number; label?: string }[];
  /** nuova scadenza delle condizioni, in ISO */
  promoUntil?: string;
  /** nota interna (chi/perché) */
  note?: string;
  /** registro delle note di consulenza: allergie, accordi presi, cosa ricordare */
  notes?: { at: string; by: string; text: string }[];
  by?: string;
  at?: string;
}

/** Quello che può viaggiare fino al telefono del cliente: numeri e date, niente
 *  note interne e niente nome di chi ha ritoccato il preventivo. */
function soloCommerciale(e: QuoteEdit): QuoteEdit {
  return {
    ...(e.qty !== undefined ? { qty: e.qty } : {}),
    ...(e.extraEur !== undefined ? { extraEur: e.extraEur } : {}),
    ...(e.codes ? { codes: e.codes } : {}),
    ...(e.promoUntil ? { promoUntil: e.promoUntil } : {}),
    ...(e.at ? { at: e.at } : {}),
  };
}

const keyOf = (ref: string) => `quote_edit:${ref.toUpperCase()}`;
/** Il rimando scritto da api.presenter.quote-revise quando un preventivo viene
 *  sostituito da uno nuovo. Si legge QUI, insieme alle modifiche, perché questa
 *  è la rotta che ogni pagina aperta rilegge da sola ogni pochi secondi: è il
 *  posto — l'unico — da cui un telefono già acceso sul preventivo vecchio può
 *  accorgersi che quel documento non è più valido, senza ricaricare niente. */
const keySuper = (ref: string) => `quote_super:${ref.toUpperCase()}`;

/** ── LA SECONDA PORTA: IL CRM ──────────────────────────────────────────────
 *  «Dentro» qui non voleva dire «sono dello studio», voleva dire «ho il cookie
 *  del presentatore» — e chi apre /CRM/preventivi quel cookie non ce l'ha, non
 *  può averlo e non ha nessun posto da cui prenderlo. Risultato: l'elenco
 *  `?refs=` rispondeva 401 alla pagina che quelle modifiche esiste per
 *  mostrarle, e i totali tornavano quelli grezzi — cioè il preventivo che il
 *  cliente ha in mano diceva una cifra e il CRM ne diceva un'altra, senza che
 *  niente andasse storto da nessuna parte.
 *  È lo stesso anello già chiuso su api.presenter.quote-owner, e si chiude allo
 *  stesso modo: `guardiaCRM` col permesso «preventivi», lo stesso che serve per
 *  aprire la pagina. Chi non può vedere i preventivi non ne legge le modifiche
 *  da un'altra strada.
 *
 *  ⚠️ SI CHIEDE PRIMA SE LA RICHIESTA PORTA CREDENZIALI CRM, e non si va al
 *   database quando non le porta. Questa rotta la interroga anche il TELEFONO
 *   DEL CLIENTE, ogni pochi secondi, per aggiornare prezzo e scadenza in
 *   diretta: una lettura in più a ogni giro sarebbe un costo pagato dal caso
 *   più frequente per servire il più raro. */
const bussaDalCRM = (request: Request): boolean =>
  !!request.headers.get("x-crm-token") || !!request.headers.get("authorization");

async function staffCRM(request: Request): Promise<boolean> {
  if (!bussaDalCRM(request)) return false;
  return (await guardiaCRM(request, cors, "preventivi")).ok;
}

/** Chi ha diritto di vedere le modifiche PER INTERO — note di consulenza
 *  comprese — e non solo la parte commerciale che va al cliente.
 *  ⚠️ È UNA DOMANDA SOLA PER TUTTI E DUE I RAMI di questa GET. Rispondere «sì»
 *   all'elenco e «no» al singolo preventivo vorrebbe dire che la stessa persona,
 *   guardando la stessa scheda da due punti della stessa pagina, legge due cose
 *   diverse. */
async function leggeTutto(request: Request): Promise<boolean> {
  //  Il presentatore per primo: è il caso più frequente e non tocca il database
  //  se il cookie non c'è.
  if (await sessioneDaRichiesta(request)) return true;
  return staffCRM(request);
}

async function cfg(key: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", key).maybeSingle();
  return (data as { value?: string | null } | null)?.value ?? null;
}
async function setCfg(key: string, value: string) {
  await supabaseAdmin.from("app_config").upsert(
    { key, value, updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
}

export const Route = createFileRoute("/api/presenter/quote-edit")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const sp = new URL(request.url).searchParams;
        const dentro = await leggeTutto(request);

        // ── ELENCO: le modifiche di PIÙ preventivi in una sola chiamata ───────
        //  Serve al pannello "Preventivi attivi", che deve dire per ognuno se le
        //  condizioni sono ancora valide. Una richiesta per riga sarebbe una
        //  raffica di query a ogni ricerca.
        //  È una vista da presentatore e basta: chiedere sessanta preventivi in
        //  colpo solo non ha nessun senso per un cliente.
        const refs = (sp.get("refs") || "").split(",").map((r) => r.trim()).filter(Boolean).slice(0, 60);
        if (refs.length) {
          if (!dentro) return nonAutorizzato(cors, { edits: {} });
          const keys = refs.map(keyOf);
          const { data } = await supabaseAdmin.from("app_config").select("key, value").in("key", keys);
          const edits: Record<string, QuoteEdit> = {};
          for (const row of (data as { key: string; value: string }[] | null) ?? []) {
            const ref = row.key.slice("quote_edit:".length);
            try { edits[ref] = JSON.parse(row.value) as QuoteEdit; } catch { /* riga illeggibile: si ignora */ }
          }
          return json({ edits });
        }

        const ref = (sp.get("ref") || "").trim();
        if (!ref) return json({ edit: null });
        //  Due chiavi, una lettura sola: le modifiche e l'eventuale rimando al
        //  preventivo che ha preso il posto di questo. Chiederle in due giri
        //  raddoppierebbe il costo del caso più frequente che questa rotta ha —
        //  una pagina aperta che si ricontrolla ogni quattro secondi.
        const { data } = await supabaseAdmin
          .from("app_config").select("key, value").in("key", [keyOf(ref), keySuper(ref)]);
        const righe = (data as { key: string; value: string | null }[] | null) ?? [];
        const valore = (k: string) => righe.find((r) => r.key === k)?.value ?? "";
        const sostituitoDa = String(valore(keySuper(ref))).trim();
        //  Il rimando esce a TUTTI, cliente compreso, e deve: è l'unica cosa che
        //  gli dice che il foglio che ha in mano non è più quello buono. Non è
        //  un dato riservato — è un numero di preventivo che sta già nel link
        //  che sta per aprire.
        const coda = sostituitoDa ? { sostituitoDa } : {};
        const raw = valore(keyOf(ref));
        if (!raw) return json({ edit: null, ...coda });
        try {
          const e = JSON.parse(raw) as QuoteEdit;
          return json({ edit: dentro ? e : soloCommerciale(e), ...coda });
        } catch { return json({ edit: null, ...coda }); }
      },
      POST: async ({ request }) => {
        let b: {
          ref?: string; code?: string; qty?: number; extraEur?: number; promoDays?: number;
          note?: string; by?: string;
          /** testo di una nuova nota interna, oppure indice di quella da togliere */
          addNote?: string; delNote?: number;
          /** codice sconto da aggiungere: il valore NON arriva dal client, si rilegge qui */
          addCode?: string; removeCode?: string;
        } = {};
        try { b = (await request.json()) as typeof b; } catch { /* ignore */ }
        const ref = (b.ref || "").trim();
        if (!ref) return json({ ok: false, reason: "ref mancante" }, 400);

        // ── CHI PUÒ MODIFICARE ───────────────────────────────────────────────
        //  Tre vie, tutte verificate qui sul server:
        //   · la sessione già aperta (il cookie del presentatore);
        //   · il PIN con cui il consulente entra nel proprio account — è quello
        //     che ha già in mano e che digita ogni giorno, quindi non deve
        //     ricordarne un secondo;
        //   · il codice consulente generale, che resta come chiave di servizio.
        //  In ogni caso si registra CHI ha modificato: un preventivo ritoccato
        //  senza un nome accanto non è verificabile.
        //  Rifiuto sempre della stessa forma (401 + error:"auth"): il browser
        //  riconosce "sessione scaduta" da una risposta sola, ovunque accada.
        const chi = await autorizzaPresentatore(request, b.code);
        if (!chi) return nonAutorizzato(cors);
        //  Col codice generale non si sa chi sia: il nome dichiarato dalla
        //  pagina serve solo lì, e resta comunque etichettato.
        const autore = chi.via === "codice"
          ? String(b.by || "codice consulente").slice(0, 80)
          : chi.nome;

        const cur: QuoteEdit = await (async () => {
          const raw = await cfg(keyOf(ref));
          try { return raw ? (JSON.parse(raw) as QuoteEdit) : {}; } catch { return {}; }
        })();

        //  ── LO SCONTO A MANO È UN'ALTRA COSA DAL CODICE SCONTO ───────────
        //  Un codice ha un valore deciso dal titolare e riletto dal database:
        //  applicarlo è lavoro da consulente. `extraEur` invece è una cifra
        //  scelta al momento — è cambiare il prezzo — e allungare la scadenza
        //  della promozione è cambiare le condizioni. Servono i permessi del
        //  listino, e il rifiuto arriva PRIMA di scrivere qualunque cosa.
        const tocca = typeof b.extraEur === "number" || typeof b.promoDays === "number";
        if (tocca && !(await accessoPresentatore(chi)).puo("listino")) return vietatoP(cors, "listino");

        const edit: QuoteEdit = { ...cur };
        if (typeof b.qty === "number" && b.qty >= 1 && b.qty <= 9) edit.qty = Math.round(b.qty);
        if (typeof b.extraEur === "number" && b.extraEur >= 0 && b.extraEur <= 50000) edit.extraEur = Math.round(b.extraEur * 100) / 100;
        if (typeof b.promoDays === "number" && b.promoDays > 0 && b.promoDays <= 120) {
          const d = new Date();
          d.setDate(d.getDate() + Math.round(b.promoDays));
          // Una scadenza di sabato o domenica è una scadenza finta: il cliente
          // non può disporre un bonifico. Si sposta al lunedì, come alla creazione.
          while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
          edit.promoUntil = d.toISOString();
        }
        // ── CODICI SCONTO ────────────────────────────────────────────────────
        //  Il valore di uno sconto non si accetta dal browser: si rilegge dalla
        //  tabella dei codici. Altrimenti basterebbe una richiesta costruita a
        //  mano per regalarsi qualsiasi cifra.
        if (b.removeCode) {
          const rm = String(b.removeCode).toUpperCase();
          edit.codes = (edit.codes ?? []).filter((c) => c.code.toUpperCase() !== rm);
        }
        if (b.addCode) {
          const codice = String(b.addCode).trim().toUpperCase().slice(0, 40);
          const { data } = await supabaseAdmin
            .from("discount_codes")
            .select("code, label, discount_eur, active, stock_total, stock_left")
            .ilike("code", codice)
            .limit(1);
          const d = (data as { code: string; label: string | null; discount_eur: number; active: boolean; stock_left: number | null }[] | null)?.[0];
          if (!d || d.active === false) return json({ ok: false, reason: "codice sconto non valido" }, 400);
          if (typeof d.stock_left === "number" && d.stock_left <= 0) return json({ ok: false, reason: "codice sconto esaurito" }, 400);
          const gia = (edit.codes ?? []).some((c) => c.code.toUpperCase() === d.code.toUpperCase());
          if (!gia) edit.codes = [...(edit.codes ?? []), { code: d.code, eur: Number(d.discount_eur) || 0, label: d.label ?? undefined }];
        }
        if (typeof b.delNote === "number") {
          const l = [...(edit.notes ?? [])];
          if (b.delNote >= 0 && b.delNote < l.length) { l.splice(b.delNote, 1); edit.notes = l; }
        }
        if (b.addNote && String(b.addNote).trim()) {
          edit.notes = [
            ...(edit.notes ?? []),
            { at: new Date().toISOString(), by: autore, text: String(b.addNote).trim().slice(0, 2000) },
          ].slice(-100);
        }
        if (b.note) edit.note = String(b.note).slice(0, 300);
        edit.by = autore;
        edit.at = new Date().toISOString();

        await setCfg(keyOf(ref), JSON.stringify(edit));
        return json({ ok: true, edit });
      },
    },
  },
});
