/** Codici sconto (coupon) gestiti dal presentatore dall'hub Impostazioni.
 *  Usa il service role: il presentatore non ha sessione Supabase (RLS bloccherebbe le scritture).
 *  GET                         -> { codes: DiscountRow[], qty: Record<string,number> }
 *  POST { action, ... }        -> "create" | "update" | "delete" | "qty"
 *  Tabella: discount_codes. Sconti per quantità: app_config.key = 'qty_discounts'.
 *
 *  ── SOLO A CHI HA L'ACCESSO ───────────────────────────────────────────────
 *  Da qui uscivano tutti i codici sconto attivi con il loro valore, e da qui si
 *  potevano CREARE: chiunque poteva farsi un codice da mille euro e usarlo.
 *  Adesso serve una sessione da presentatore. Il cliente non passa mai di qui —
 *  il valore di un codice applicato lo rilegge il server in quote-edit.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { leggiMappa, type MappaGaranzie } from "@/shop/garanzia-codici";
import { INTESTAZIONI_CONSENTITE, guardia, guardiaP, sessioneDaRichiesta } from "./api.presenter.consultant";
/*  ── ⚠️ OGNI CONSULENTE HA I SUOI SCONTI ──────────────────────────────────
    Richiesta del committente: «gli altri consulenti hanno le loro modifiche —
    codici sconto, listino, eccetera».
    Sconti quantità, garanzie e durata delle promozioni stanno in `app_config`,
    quindi bastava la chiave col suo id (la stessa regola del listino).
    I CODICI invece stanno in una tabella che non ha una colonna «di chi è»:
    il proprietario si tiene in una riga a parte (`coupons_owner`), mappa
    codice → consulente. Un codice senza proprietario è di casa e lo vedono
    tutti — ed è quello che sono, oggi, TUTTI i codici già creati: nessuno
    deve sparire il giorno della pubblicazione. */
import { BASE_GARANZIE, BASE_PROMO, BASE_PROPRIETARI, BASE_QUANTITA, codiciVisibili, idAmbito, puoToccareIlCodice } from "@/shop/ambito-listino";
import { grezzoAmbito, scriviAmbito } from "@/crm/listino-di-chi.server";

/** ── 450,73 È UN NUMERO ─────────────────────────────────────────────────────
 *  In italiano i decimali si scrivono con la virgola, ed è così che vengono
 *  digitati. `Number("450,73")` però vale NaN: il valore veniva scartato e lo
 *  sconto finiva a zero senza dire niente. Qui la virgola si accetta, come già
 *  fa il CRM (numeroDaTesto), e si accetta anche il punto delle migliaia
 *  quando è chiaramente tale ("1.250,50").
 *  Restituisce null se non è un numero: chi chiama decide se è un errore o un
 *  campo lasciato vuoto — due cose diverse che non vanno confuse con lo zero. */
export function euroDaValore(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let t = v.trim().replace(/[€\s]/g, "");
  if (t === "") return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE,
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** Chi sta chiedendo, ridotto a un id buono per una chiave. Vuoto = chiavi di
 *  casa (il codice consulente generale, o il proprietario): chi entra così
 *  legge e scrive la riga condivisa, che è il punto di partenza di tutti. */
async function chiSta(request: Request): Promise<string> {
  const s = await sessioneDaRichiesta(request);
  return s && s.via === "pin" ? idAmbito(s.id) : "";
}

async function readQty(mio: string): Promise<Record<string, number>> {
  const { valore } = await grezzoAmbito(BASE_QUANTITA, mio);
  try {
    return (JSON.parse(valore ?? "{}") as Record<string, number>) || {};
  } catch {
    return {};
  }
}

/** Di chi è ogni codice. Una riga sola, condivisa: non è «roba del
 *  consulente», è l'elenco di chi possiede cosa — e va letto per intero da
 *  chiunque, altrimenti non si può sapere cosa NON mostrare. */
async function readProprietari(): Promise<Record<string, string>> {
  const { valore } = await grezzoAmbito(BASE_PROPRIETARI, "");
  try {
    return (JSON.parse(valore ?? "{}") as Record<string, string>) || {};
  } catch {
    return {};
  }
}

async function scriviProprietario(codice: string, consulente: string) {
  const mappa = await readProprietari();
  const k = codice.trim().toLowerCase();
  if (consulente) mappa[k] = consulente;
  else delete mappa[k];
  await scriviAmbito(BASE_PROPRIETARI, "", JSON.stringify(mappa));
}

/** La garanzia decisa codice per codice. Vive in `app_config` e non in due
 *  colonne di `discount_codes` — il perché sta in cima a shop/garanzia-codici. */
async function readGaranzie(mio: string): Promise<MappaGaranzie> {
  const { valore } = await grezzoAmbito(BASE_GARANZIE, mio);
  return leggiMappa(valore ?? undefined);
}

/** I codici che QUESTO consulente deve vedere: i suoi e quelli di casa.
 *  ⚠️ Il filtro sta qui e non nella pagina: un elenco filtrato solo a schermo
 *   è un elenco che chiunque può rileggere per intero dalla rete. */
async function readCodes(mio: string) {
  const { data } = await supabaseAdmin
    .from("discount_codes")
    .select("*")
    .order("created_at", { ascending: false });
  return codiciVisibili((data ?? []) as { code?: string | null }[], await readProprietari(), mio);
}

/** Il codice scritto su una riga, per sapere se chi la tocca ne ha diritto. */
async function codiceDellaRiga(id: string): Promise<string> {
  const { data } = await supabaseAdmin.from("discount_codes").select("code").eq("id", id).maybeSingle();
  return String((data as { code?: string } | null)?.code ?? "");
}

/** Può toccarla? Il suo codice, o uno di casa. Cancellare il codice di un
 *  collega è un errore che non si vede finché non serve quel codice. */
async function suoDaToccare(id: string, mio: string): Promise<boolean> {
  const codice = await codiceDellaRiga(id);
  if (!codice) return false;
  const proprietari = await readProprietari();
  return puoToccareIlCodice(proprietari[codice.trim().toLowerCase()], mio);
}

export const Route = createFileRoute("/api/presenter/coupons")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const no = await guardia(request, cors, { codes: [], qty: {} });
        if (no) return no;
        const mio = await chiSta(request);
        const { valore } = await grezzoAmbito(BASE_PROMO, mio);
        const promoDays = Number(valore) || 0;
        return json({
          codes: await readCodes(mio),
          qty: await readQty(mio),
          promoDays,
          garanzie: await readGaranzie(mio),
          //  Il pannello lo dice a chiare lettere: stai modificando il tuo, o
          //  quello di casa? Senza questa riga si ritocca un listino senza
          //  sapere di chi è.
          ambito: mio ? "consulente" : "casa",
        });
      },
      POST: async ({ request }) => {
        //  Creare un coupon è creare denaro: chi lo può fare è chi decide il
        //  listino. La LETTURA resta a tutti — il consulente deve poter vedere
        //  quale codice sta applicando al cliente che ha davanti.
        const no = await guardiaP(request, cors, "listino");
        if (no) return no;
        const mio = await chiSta(request);
        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          /* ignore */
        }
        const action = String(body.action || "");

        if (action === "create") {
          const total =
            body.stock_total != null && body.stock_total !== "" ? Number(body.stock_total) : null;
          const { error } = await supabaseAdmin.from("discount_codes").insert({
            code: String(body.code || "")
              .trim()
              .toUpperCase(),
            label: String(body.label || "").trim() || null,
            discount_eur: euroDaValore(body.discount_eur) ?? 0,
            stock_total: total,
            stock_left:
              body.stock_left != null && body.stock_left !== "" ? Number(body.stock_left) : total,
            active: true,
            auto_apply: !!body.auto_apply,
            apply_message: String(body.apply_message || "").trim() || null,
            scarcity_title: String(body.scarcity_title || "").trim() || null,
            scarcity_text: String(body.scarcity_text || "").trim() || null,
          } as never);
          if (error)
            return json(
              {
                ok: false,
                reason: error.message.includes("duplicate") ? "duplicate" : error.message,
              },
              400,
            );
          //  Il codice appena creato è suo. Chi entra con le chiavi di casa non
          //  timbra niente: quello che crea è un codice di casa, di tutti.
          if (mio)
            await scriviProprietario(String(body.code || "").trim().toUpperCase(), mio);
          return json({ ok: true, codes: await readCodes(mio) });
        }

        if (action === "update") {
          const id = String(body.id || "");
          const values =
            body.values && typeof body.values === "object"
              ? (body.values as Record<string, unknown>)
              : {};
          if (!id) return json({ ok: false, reason: "missing_id" }, 400);
          if (!(await suoDaToccare(id, mio)))
            return json({ ok: false, reason: "Questo codice è di un altro consulente" }, 403);
          //  Anche in modifica lo sconto può arrivare scritto con la virgola.
          if ("discount_eur" in values) {
            const e = euroDaValore(values.discount_eur);
            if (e == null) return json({ ok: false, reason: "sconto non valido" }, 400);
            values.discount_eur = e;
          }
          const { error } = await supabaseAdmin
            .from("discount_codes")
            .update(values as never)
            .eq("id", id);
          if (error) return json({ ok: false, reason: error.message }, 400);
          return json({ ok: true, codes: await readCodes(mio) });
        }

        if (action === "delete") {
          const id = String(body.id || "");
          if (!id) return json({ ok: false, reason: "missing_id" }, 400);
          if (!(await suoDaToccare(id, mio)))
            return json({ ok: false, reason: "Questo codice è di un altro consulente" }, 403);
          const codice = await codiceDellaRiga(id);
          await supabaseAdmin.from("discount_codes").delete().eq("id", id);
          //  Via anche il timbro: lasciarlo vorrebbe dire una mappa che cresce
          //  di codici che non esistono più, e un codice riusato domani che
          //  nasce già di proprietà di qualcuno.
          if (codice) await scriviProprietario(codice, "");
          return json({ ok: true, codes: await readCodes(mio) });
        }

        if (action === "qty") {
          const qty =
            body.qty && typeof body.qty === "object" ? (body.qty as Record<string, unknown>) : {};
          const out: Record<string, number> = {};
          //  Gli sconti per quantità hanno gli stessi decimali dei coupon: due
          //  impianti possono valere 450,73 di sconto quanto un codice.
          Object.entries(qty).forEach(([k, v]) => {
            const n = euroDaValore(v);
            if (n != null && n > 0) out[k] = n;
          });
          await scriviAmbito(BASE_QUANTITA, mio, JSON.stringify(out));
          return json({ ok: true, qty: out });
        }

        if (action === "garanzia") {
          //  ── LA GARANZIA DI UN CODICE ────────────────────────────────────
          //   Si riscrive una voce sola della mappa, non la mappa intera: due
          //   schede aperte sullo stesso pannello, salvando la mappa per intero,
          //   si cancellerebbero le modifiche a vicenda senza dire niente.
          const codice = String(body.code || "")
            .trim()
            .toUpperCase();
          if (!codice) return json({ ok: false, reason: "missing_code" }, 400);
          const mappa = await readGaranzie(mio);
          if (body.rimuovi === true) delete mappa[codice];
          else {
            const importo = euroDaValore(body.importo);
            /*  ── ⚠️ E I LIMITI DELL'OFFERTA ───────────────────────────────
                Richiesta del committente: «posso impostare importo fisso sulla
                garanzia 15 mesi e dice esplicitamente poi sulla garanzia che è
                limitata con i posti e data».
                Un numero storto diventa «nessun limite», non «zero posti»: zero
                spegnerebbe l'offerta per un carattere sbagliato, e la promo
                sparirebbe dal preventivo senza che nessuno capisca perché. */
            const intero = (v: unknown): number | undefined => {
              const n = Math.round(Number(v));
              return Number.isFinite(n) && n >= 0 ? n : undefined;
            };
            //  `null` esplicito = «togli il limite»: si distingue da «campo non
            //  mandato» (undefined), che invece non deve cancellare niente.
            const posti = body.posti === null ? undefined : intero(body.posti);
            const postiTotali = body.postiTotali === null ? undefined : intero(body.postiTotali);
            const scadenza = String(body.scadenza ?? "").slice(0, 10);
            const titolo = String(body.titolo ?? "").trim().slice(0, 80);
            //  «Scade fra N giorni»: la data la calcola chi la mostra, dal
            //  giorno in cui quel preventivo è nato (vedi `scadenzaEffettiva`).
            const giorni = body.giorni === null ? undefined : intero(body.giorni);
            mappa[codice] = {
              mostra: body.mostra !== false,
              //  ⚠️ Zero vuol dire «non l'ho impostata» e fa tornare al listino
              //   (vedi routes/preventivo): una garanzia mostrata a «0,00 €» si
              //   legge come «è gratis», ed è la promessa più cara che quella
              //   pagina possa fare per sbaglio.
              importo: importo != null && importo > 0 ? importo : 0,
              //  ⚠️ O una percentuale, che è l'altro modo di dire la stessa
              //   offerta: se c'è comanda lei (vedi `tipoOfferta`). Si manda
              //   sempre, anche a zero, perché passare da «−30%» a «550 €»
              //   deve cancellare il 30 — se restasse, continuerebbe a vincere.
              ...(Number(body.sconto) > 0 ? { sconto: Math.min(100, Math.round(Number(body.sconto))) } : {}),
              ...(posti !== undefined ? { posti } : {}),
              ...(postiTotali !== undefined && postiTotali > 0 ? { postiTotali } : {}),
              ...(/^\d{4}-\d{2}-\d{2}$/.test(scadenza) ? { scadenza } : {}),
              ...(giorni !== undefined && giorni > 0 ? { giorni } : {}),
              ...(titolo ? { titolo } : {}),
            };
          }
          await scriviAmbito(BASE_GARANZIE, mio, JSON.stringify(mappa));
          return json({ ok: true, garanzie: mappa });
        }

        if (action === "promoDays") {
          const n = Number(body.promoDays);
          if (!Number.isFinite(n) || n < 1 || n > 120)
            return json({ ok: false, reason: "valore non valido" }, 400);
          await scriviAmbito(BASE_PROMO, mio, String(Math.round(n)));
          return json({ ok: true, promoDays: Math.round(n) });
        }

        return json({ ok: false, reason: "unknown_action" }, 400);
      },
    },
  },
});
