/** L'ANTEPRIMA DI UN LINK — dove si deposita, e chi può depositarla
 *  ═══════════════════════════════════════════════════════════════════════════
 *
 *  POST multipart/form-data { tipo, codice, file }  -> { ok, url }
 *  GET  ?tipo=…&codice=…                            -> { ok, url } | { ok:false }
 *
 *  ── PERCHÉ L'IMMAGINE ARRIVA GIÀ FATTA DAL BROWSER ────────────────────────
 *  L'anteprima che WhatsApp mostra deve stare a un indirizzo pubblico, servita
 *  come JPEG vero: i programmi di messaggistica non eseguono JavaScript, non
 *  disegnano niente e — dettaglio che decide tutto — NON leggono le immagini
 *  SVG. Quindi l'immagine va prodotta prima e depositata da qualche parte.
 *
 *  Produrla qui dentro non si può: questo servizio gira su Cloudflare Workers,
 *  dove non esiste una tela su cui disegnare né un carattere tipografico da
 *  usare. Le vie alternative — un motore di rasterizzazione WebAssembly, o il
 *  servizio a pagamento che apre un browser vero — costano molto più di quanto
 *  serva, visto che il disegno esiste GIÀ ed è quello che il consulente vede a
 *  schermo un istante prima di premere «manda».
 *
 *  Quindi: il browser disegna (è lo stesso disegno del biglietto, stesso
 *  carattere, stesso risultato), rimpicciolisce, e deposita qui. Il vantaggio
 *  non è solo tecnico: l'anteprima che il cliente riceve è *letteralmente* la
 *  stessa immagine che il consulente ha approvato, non una seconda versione
 *  scritta da un'altra mano che un giorno divergerà.
 *
 *  ── PERCHÉ IL PERCORSO È PREVEDIBILE E SI SOVRASCRIVE ─────────────────────
 *  Un nome a caso per ogni deposito lascerebbe dietro di sé una scia di
 *  immagini morte a ogni ristampa, e soprattutto cambierebbe l'indirizzo: i
 *  server di WhatsApp tengono in cache l'anteprima di un link per giorni, e un
 *  indirizzo che cambia non aggiorna niente — fa solo sparire quello vecchio.
 *  Un file per codice, sempre lo stesso, sovrascritto.
 *
 *  ── CHI PUÒ SCRIVERE ──────────────────────────────────────────────────────
 *  ⚠️ Questa rotta scrive in uno spazio pubblico servito dal dominio del
 *  centro: senza un controllo sarebbe una porta aperta per depositare qualunque
 *  file e ottenerne un indirizzo credibile (è esattamente il buco che è già
 *  stato chiuso su api.presenter.upload). Due porte diverse, perché i due casi
 *  hanno due mittenti diversi:
 *
 *   · `invito` — nasce dal CRM, dove una sessione c'è sempre: si chiede il
 *     permesso «agenda», lo stesso che serve per creare il link.
 *   · `preventivo` — nasce sulla pagina pubblica del preventivo, dove una
 *     sessione NON c'è (la usa il cliente insieme al consulente). Lì il
 *     lasciapassare è il preventivo stesso: si accetta solo se quel codice
 *     esiste davvero fra i preventivi salvati. Non si può inventare un codice
 *     e non si può depositare un'immagine per un preventivo che non c'è.
 *
 *  In più, per tutti: solo JPEG, e non oltre mezzo mega. Un'anteprima più
 *  pesante WhatsApp non la mostra nemmeno, quindi il limite non toglie niente
 *  a nessuno e toglie a chi passa di qui la voglia di usarci come deposito.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { guardiaCRM } from "./api.crm.accesso";
import { guardia as guardiaPresentatore } from "./api.presenter.consultant";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CRM-Sessione, X-Consulente",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const BUCKET = "anteprime";
const PESO_MASSIMO = 512 * 1024;

/** ⚠️ `webinar` è arrivato per ultimo e per una ragione precisa: il link della
 *  sala si manda a decine di persone in una volta, e mostrava la scheda della
 *  VIDEOCONSULENZA — un'altra cosa, con un'altra promessa. */
export type TipoAnteprima = "invito" | "preventivo" | "webinar" | "capelli";

/** ⚠️ Il codice finisce dentro un nome di file e dentro una chiave: tutto ciò
 *  che non è lettera, cifra, trattino o punto se ne va. Senza questa riga un
 *  codice con una barra dentro scriverebbe in una cartella che nessuno ha
 *  chiesto. */
const codicePulito = (v: unknown) =>
  String(v ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 64);

const tipoPulito = (v: unknown): TipoAnteprima | null =>
  v === "invito" || v === "preventivo" || v === "webinar" || v === "capelli" ? v : null;

export const chiaveAnteprima = (tipo: TipoAnteprima, codice: string) =>
  `anteprima:${tipo}:${codice}`;

/** Il deposito di questo link: l'indirizzo e QUANDO è stato messo lì.
 *  ⚠️ L'ora serve, non è un di più: è quella che decide per quanto tempo
 *   l'immagine si può tenere in cassetto (vedi shop/anteprima-quanto-dura —
 *   appena depositata può ancora cambiare, dopo non cambia più). */
export async function anteprimaDepositata(
  tipo: TipoAnteprima,
  codice: string,
): Promise<{ url: string; quando: number }> {
  const c = codicePulito(codice);
  if (!c) return { url: "", quando: 0 };
  try {
    const { data } = await supabaseAdmin
      .from("app_config")
      .select("value,updated_at")
      .eq("key", chiaveAnteprima(tipo, c))
      .maybeSingle();
    const riga = data as { value?: string | null; updated_at?: string | null } | null;
    const v = riga?.value;
    if (!v || !/^https?:\/\//i.test(v)) return { url: "", quando: 0 };
    const t = Date.parse(String(riga?.updated_at || ""));
    return { url: v, quando: Number.isFinite(t) ? t : 0 };
  } catch {
    return { url: "", quando: 0 };
  }
}

/** L'indirizzo depositato per questo link, se c'è. Lo usa anche la rotta che
 *  serve l'immagine all'anteprima (api.og.anteprima). */
export async function urlAnteprima(tipo: TipoAnteprima, codice: string): Promise<string> {
  return (await anteprimaDepositata(tipo, codice)).url;
}

/** Il preventivo esiste davvero? È il lasciapassare del caso pubblico. */
async function preventivoEsiste(ref: string): Promise<boolean> {
  try {
    /*  ⚠️ LA TABELLA SI CHIAMA `quote_requests`. Qui c'era `quotes`, che nel
        database non esiste: la query falliva SEMPRE, quindi questo
        lasciapassare rispondeva sempre «non esiste» e il deposito
        dell'anteprima ricadeva sempre sulla sessione da presentatore — cioè
        non funzionava per chi una sessione non ce l'ha. Nessuno se n'era
        accorto perché l'errore finiva nel `catch` qui sotto, e perché con i
        tipi generati vecchi TypeScript non poteva dirlo: `quotes` era solo una
        stringa. Trovato rigenerando i tipi dallo schema vero. */
    const { data } = await supabaseAdmin
      .from("quote_requests")
      .select("quote_ref")
      .eq("quote_ref", ref)
      .limit(1);
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/anteprima")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const u = new URL(request.url);
        const tipo = tipoPulito(u.searchParams.get("tipo"));
        const codice = codicePulito(u.searchParams.get("codice"));
        if (!tipo || !codice) return json({ ok: false, reason: "bad_request" }, 400);
        const url = await urlAnteprima(tipo, codice);
        return url ? json({ ok: true, url }) : json({ ok: false, reason: "assente" }, 404);
      },

      POST: async ({ request }) => {
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ ok: false, reason: "bad_form" }, 400);
        }

        const tipo = tipoPulito(form.get("tipo"));
        const codice = codicePulito(form.get("codice"));
        const file = form.get("file") as File | null;
        if (!tipo || !codice) return json({ ok: false, reason: "bad_request" }, 400);
        if (!file) return json({ ok: false, reason: "no_file" }, 400);

        //  ⚠️ Il tipo dichiarato dal browser non basta: si guarda il peso, che
        //  è l'unica cosa che non si può mentire.
        if (file.size > PESO_MASSIMO) return json({ ok: false, reason: "troppo_grande" }, 413);
        if (file.type && !/^image\/jpe?g$/i.test(file.type)) {
          return json({ ok: false, reason: "non_jpeg" }, 415);
        }

        //  ⚠️ Il webinar nasce SOLO nel CRM — la sala la crea chi conduce, mai
        //   il pubblico — quindi qui basta e serve la sessione del CRM. Senza
        //   questa riga la rotta accetterebbe da chiunque un'immagine da
        //   servire sul dominio del centro.
        if (tipo === "invito" || tipo === "webinar" || tipo === "capelli") {
          //  ⚠️ Due porte, perché il biglietto della stanza nasce in DUE posti
          //  diversi: nel CRM, dove c'è una sessione CRM, e dentro l'app del
          //  presentatore, dove c'è una sessione da presentatore e basta —
          //  ed è proprio lì che il consulente copia il link da mandare al
          //  cliente. Chiedere solo la prima significava rifiutare in silenzio
          //  l'unico momento che conta davvero.
          const g = await guardiaCRM(request, cors, "agenda");
          if (!g.ok) {
            const no = await guardiaPresentatore(request, cors);
            if (no) return g.risposta;
          }
        } else {
          //  Due lasciapassare, perché ci sono due momenti:
          //   · a preventivo confermato il codice È il numero del preventivo, e
          //     basta che esista in archivio (la pagina è pubblica, il cliente
          //     la usa insieme al consulente e una sessione lì non c'è);
          //   · PRIMA che il preventivo esista il consulente manda comunque il
          //     link della consulenza dal vivo, che porta il codice di sessione
          //     e non un numero: lì l'unico lasciapassare possibile è la
          //     sessione da presentatore di chi sta lavorando.
          const esiste = await preventivoEsiste(codice);
          if (!esiste) {
            const no = await guardiaPresentatore(request, cors);
            if (no) return json({ ok: false, reason: "preventivo_sconosciuto" }, 403);
          }
        }

        await supabaseAdmin.storage.createBucket(BUCKET, { public: true }).catch(() => {});

        const percorso = `${tipo}-${codice}.jpg`;
        const bytes = new Uint8Array(await file.arrayBuffer());
        const { error } = await supabaseAdmin.storage.from(BUCKET).upload(percorso, bytes, {
          contentType: "image/jpeg",
          //  Sovrascrive: stesso link, stesso indirizzo (vedi in cima).
          upsert: true,
          //  ⚠️ Un'ora, non un anno: se il consulente ristampa l'anteprima
          //  perché la prima era sbagliata, l'indirizzo è lo stesso e solo una
          //  scadenza breve fa arrivare davvero quella nuova.
          cacheControl: "3600",
        });
        if (error) return json({ ok: false, reason: error.message }, 500);

        const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(percorso);
        const url = String(data?.publicUrl || "");
        if (!url) return json({ ok: false, reason: "senza_indirizzo" }, 500);

        //  ⚠️ La memoria di «esiste un'anteprima per questo codice» sta qui e
        //  non si deduce dal deposito: chiedere allo spazio file se un oggetto
        //  c'è costa una chiamata in più a ogni anteprima mostrata, e questa
        //  riga la legge chi serve l'immagine, che è la strada più calda di
        //  tutte.
        await supabaseAdmin.from("app_config").upsert(
          {
            key: chiaveAnteprima(tipo, codice),
            value: url,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "key" },
        );

        return json({ ok: true, url });
      },
    },
  },
});
