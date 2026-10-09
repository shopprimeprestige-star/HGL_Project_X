/** Lista media (video + foto) della pagina presentazione (gestita dal presentatore).
 *  GET                    -> { videos: [{name,url,kind}], firma }
 *  POST {name,url,kind}   -> aggiunge un media (per URL o dopo l'upload)
 *  PATCH {url,name}       -> rinomina un media già in elenco
 *  PUT {ordine,firma}     -> RIORDINA la libreria: cambia SOLO la disposizione
 *  DELETE ?url=...   -> rimuove
 *  Salvata in app_config.key = 'presenter_videos' via service role.
 *  L'ORDINE DELL'ARRAY È L'ORDINE A SCHERMO: non c'è nessuna colonna "posizione"
 *  e non serve, perché non c'è nessun altro posto in cui l'ordine possa vivere.
 *
 *  Ogni risposta che porta `videos` porta anche `firma`: è l'impronta
 *  dell'ordine appena letto, e il client la rimanda col PUT per dire "stavo
 *  guardando QUESTA lista". Vedi firmaDi() più sotto.
 *
 *  LETTURA APERTA, SCRITTURA NO: l'elenco si vede nella pagina presentazione,
 *  anche sul telefono del cliente. Cambiarlo è invece cambiare quello che viene
 *  mostrato in consulenza: serve l'accesso da presentatore.
 *  La RINOMINA è una scrittura come le altre: stessa `guardia`, stessa porta.
 *  Il RIORDINO pure: è la disposizione che il consulente si trova davanti al
 *  prossimo accesso, quindi passa dalla stessa porta e non da una più larga.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { INTESTAZIONI_CONSENTITE, guardiaP } from "./api.presenter.consultant";

const cors = {
  "Access-Control-Allow-Origin": "*",
  // ⚠️ PUT va elencato qui, non solo fra gli handler: senza, la preflight del
  // browser lo rifiuta prima ancora di chiamarci e il riordino "non salva" per
  // un motivo che nei log del server non compare, perché il server non lo vede.
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE,
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

type Kind = "video" | "image";
interface Vid { name: string; url: string; kind?: Kind }

const IMG_RE = /\.(jpe?g|png|gif|webp|avif|bmp|svg|heic|heif)(\?|#|$)/i;
/** kind dedotto: esplicito dal client, altrimenti dall'estensione dell'URL. */
function inferKind(url: string, explicit?: string): Kind {
  if (explicit === "image" || explicit === "video") return explicit;
  return IMG_RE.test(url) ? "image" : "video";
}
/** Lunghezza massima di un nome: la riga della libreria deve restare leggibile
 *  e app_config non è il posto dove far crescere una stringa senza limiti. */
const MAX_NOME = 120;
/** Tetto sugli url che arrivano nel corpo del riordino, lo stesso di
 *  src/media/galleria.ts: un url più lungo di così non è un url, è un file
 *  incollato dentro un campo di testo. */
const MAX_URL = 2000;
/** Tetto sul numero di voci accettate in UN riordino. La libreria non ha (e non
 *  aveva) alcun limite di lunghezza: senza questa riga il PUT diventerebbe la
 *  porta da cui entra un array lungo quanto pare a chi lo manda. 300 è molto
 *  più di qualunque libreria vera e molto meno di un problema. */
const MAX_ORDINE = 300;

/** Una voce ripulita: nome sempre stringa non vuota, kind sempre valido.
 *  (retrocompatibilità: le voci salvate prima di questa feature non hanno kind → video)
 *
 *  ⚠️ E l'url si TAGLIA agli estremi, che non è pignoleria di stile: quell'url è
 *  l'IDENTITÀ con cui il media viene rinominato, cancellato e riordinato. Il
 *  POST lo taglia già in scrittura, ma i dati scritti da versioni precedenti —
 *  o una riga corretta a mano dal pannello Supabase — possono portarsi dietro
 *  uno spazio. Il client poi rimanda l'url com'è: il riordino non lo riconosce,
 *  lo tratta come "voce che non conosco" e lo spedisce IN CIMA a ogni singolo
 *  riordino, cioè un media che si sposta da solo senza che nessuno l'abbia
 *  toccato. Stessa causa, altro sintomo: la rinomina di quella riga
 *  risponderebbe `not_found` per sempre. */
const normalizza = (v: Record<string, unknown>): Vid => ({
  name: typeof v.name === "string" && v.name.trim() ? v.name.trim().slice(0, MAX_NOME) : "Media",
  url: String(v.url).trim(),
  kind: v.kind === "image" ? "image" : "video",
});

/** ── CIÒ CHE È SALVATO NON È UN TIPO, È UNA STRINGA DI CUI CI SI FIDA ───────
 *  Qui il JSON veniva castato a Vid[] e mappato subito. Ma questo valore è
 *  scritto da versioni precedenti del prodotto e resta modificabile a mano dal
 *  pannello Supabase: può non essere un array, o contenere voci nulle o senza
 *  url. Una sola voce malformata basta a lasciare il consulente con la libreria
 *  vuota mentre il cliente lo guarda. Si scarta l'inutilizzabile invece di
 *  fidarsi del cast.
 */
async function readList(): Promise<Vid[]> {
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", "presenter_videos").maybeSingle();
  let grezzo: unknown;
  try { grezzo = JSON.parse((data as { value?: string } | null)?.value ?? "[]"); } catch { return []; }
  if (!Array.isArray(grezzo)) return [];
  //  ⚠️ E DUE VOCI CON LO STESSO URL NON SONO DUE MEDIA: sono una riga scritta
  //  due volte (dati vecchi, un doppio invio, una correzione a mano). Finché si
  //  aggiungeva e basta non dava fastidio; col riordino diventa un vicolo cieco,
  //  perché la permutazione nomina quell'url UNA volta e ne toglie DUE — il
  //  conto di sicurezza non torna, il PUT risponde `riordino_incoerente` e la
  //  disposizione non si salva più, per sempre, con l'unico messaggio possibile
  //  che è "non sono riuscito a salvare". A schermo, in più, sono due righe con
  //  la stessa `key` di React. Vale la PRIMA comparsa: è quella che il
  //  consulente ha in testa come posizione del media.
  const visti = new Set<string>();
  return grezzo
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v))
    .filter((v) => typeof v.url === "string" && v.url.trim() !== "")
    .map(normalizza)
    .filter((v) => {
      if (visti.has(v.url)) return false;
      visti.add(v.url);
      return true;
    });
}

/** ── LA SCRITTURA ADESSO DICE SE È ANDATA ───────────────────────────────────
 *  Prima l'esito dell'upsert non lo guardava nessuno: se Supabase rifiutava,
 *  la rotta rispondeva `ok:true` lo stesso, il consulente vedeva la lista
 *  nuova e il database teneva la vecchia — se ne accorgeva al ricaricamento,
 *  cioè nel momento peggiore. Col riordino diventa intollerabile: il client
 *  torna all'ordine precedente proprio quando il salvataggio fallisce, quindi
 *  un `ok:true` falso lo farebbe mentire e basta.
 *  Torna `true` se la riga è davvero stata scritta.
 */
async function writeList(list: Vid[]): Promise<boolean> {
  const esito = await supabaseAdmin.from("app_config").upsert(
    { key: "presenter_videos", value: JSON.stringify(list), updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
  return !(esito as { error?: unknown } | null)?.error;
}

/** ── L'IMPRONTA DELL'ORDINE ─────────────────────────────────────────────────
 *  FNV-1a a 32 bit sugli url in fila, più il conteggio davanti. Serve a una
 *  domanda sola: "la lista che il consulente aveva sotto gli occhi è ancora
 *  quella?". Il client la riceve, la conserva e la rimanda col PUT — non la
 *  calcola MAI da sé, altrimenti la calcolerebbe sulla propria lista già
 *  spostata e il controllo passerebbe sempre.
 *
 *  ⚠️ NON si usa `updated_at`: quella cambia anche per una rinomina, e una
 *  rinomina fatta da un'altra scheda non ha nessun motivo di far fallire un
 *  riordino — il nome nuovo si conserva comunque, perché qui si permuta la
 *  lista VERA, non quella mandata dal client.
 *  Il separatore fra un url e l'altro non è un vezzo: senza, "ab"+"c" e
 *  "a"+"bc" darebbero la stessa impronta, cioè due ordini diversi confusi.
 */
function firmaDi(list: Vid[]): string {
  let h = 0x811c9dc5;
  for (const v of list) {
    for (let i = 0; i < v.url.length; i++) { h ^= v.url.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    h ^= 10; h = Math.imul(h, 0x01000193);
  }
  return `${list.length}-${(h >>> 0).toString(16)}`;
}
/** La risposta buona è sempre la stessa forma: la lista INTERA più la sua
 *  impronta. Chi la riceve non deve ricostruire niente, sostituisce e basta. */
const conLista = (list: Vid[], extra: Record<string, unknown> = {}, status = 200) =>
  json({ ok: status < 400, videos: list, firma: firmaDi(list), ...extra }, status);

export const Route = createFileRoute("/api/presenter/videos")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async () => {
        const list = await readList();
        return json({ videos: list, firma: firmaDi(list) });
      },
      POST: async ({ request }) => {
        const no = await guardiaP(request, cors, "impostazioni");
        if (no) return no;
        let body: Vid = { name: "", url: "" };
        try { body = (await request.json()) as Vid; } catch { /* ignore */ }
        const url = (body.url || "").trim();
        if (!url) return json({ ok: false, reason: "missing_url" }, 400);
        const list = await readList();
        // Il media nuovo entra in CIMA, ed è voluto: è lì che lo cerca chi
        // l'ha appena caricato. Se dà fastidio, adesso si sposta con un clic.
        if (!list.some((v) => v.url === url)) list.unshift({ name: (body.name || "Media").trim(), url, kind: inferKind(url, body.kind) });
        if (!(await writeList(list))) return conLista(await readList(), { reason: "scrittura_fallita" }, 500);
        return conLista(list);
      },
      // ── RINOMINA ────────────────────────────────────────────────────────
      //  Cambia SOLO il nome: url e kind restano quelli, così il media in
      //  mostra sul telefono del cliente non si interrompe mentre rinomini.
      //  Il nome vuoto non è un modo per cancellare il nome: si rifiuta e
      //  resta quello di prima (una riga senza nome è una riga illeggibile,
      //  che è il problema che stiamo risolvendo).
      PATCH: async ({ request }) => {
        const no = await guardiaP(request, cors, "impostazioni");
        if (no) return no;
        let body: { url?: unknown; name?: unknown } = {};
        try { body = (await request.json()) as typeof body; } catch { /* ignore */ }
        const url = typeof body.url === "string" ? body.url.trim() : "";
        const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NOME) : "";
        if (!url) return json({ ok: false, reason: "missing_url" }, 400);
        if (!name) return json({ ok: false, reason: "empty_name" }, 400);
        const list = await readList();
        const i = list.findIndex((v) => v.url === url);
        // Media sparito nel frattempo (cancellato da un'altra scheda): si
        // restituisce comunque l'elenco vero, così l'interfaccia si allinea.
        if (i < 0) return conLista(list, { ok: false, reason: "not_found" }, 404);
        list[i] = { ...list[i], name };
        if (!(await writeList(list))) return conLista(await readList(), { reason: "scrittura_fallita" }, 500);
        return conLista(list);
      },
      // ── RIORDINO ────────────────────────────────────────────────────────
      //  Il committente ha chiesto di poter cambiare la disposizione dei media.
      //  Questo metodo fa QUELLO e nient'altro: permuta. Non aggiunge, non
      //  toglie, non rinomina, non cambia il tipo di un media.
      //
      //  ⚠️ IL CORPO PORTA SOLO INDIRIZZI, MAI OGGETTI, ED È LA REGOLA CHE
      //  TIENE IN PIEDI TUTTO IL RESTO. Il modo che verrebbe in mente per
      //  primo — il client manda l'array completo [{name,url,kind}…] nel nuovo
      //  ordine e il server lo scrive — è sbagliato, e il caso in cui si rompe
      //  non è raro, è la normalità: due schede aperte, in una il collega
      //  cancella tre foto e ne carica due, nell'altra il consulente sposta una
      //  riga e salva. Quella seconda scheda ha in memoria la fotografia di
      //  ieri: scrivendo quello che porta, le tre cancellate RESUSCITANO (e
      //  sono spesso file già tolti dallo Storage, cioè miniature rotte davanti
      //  al cliente) e le due nuove SPARISCONO. Senza un errore, senza un
      //  avviso, senza che nessuno l'abbia chiesto.
      //  Mandando solo indirizzi, il server non impara mai da questo corpo che
      //  cosa un media SIA: legge la lista vera e la rimescola. Una voce che il
      //  client non conosce non può essere creata, una voce che il client non
      //  ha mandato non può essere distrutta.
      //
      //  Le due difese servono a cose diverse e ci sono entrambe:
      //   • l'INTERSEZIONE (qui sotto) impedisce il danno — l'insieme dei media
      //     è invariante per costruzione, questa operazione può solo permutare,
      //     e regge anche se il controllo della firma avesse un buco;
      //   • la FIRMA impedisce la bugia — senza, l'operazione riesce ma mette
      //     la riga in un posto diverso da quello che il consulente vedeva, e
      //     lui manda al cliente un ordine che non ha mai costruito.
      //  Per questo il disallineamento si RIFIUTA (409 con l'elenco vero) e non
      //  si applica a metà in silenzio: applicarlo alla sola parte che combacia
      //  sarebbe sicuro per i dati ma muto per la persona, e il consulente
      //  scoprirebbe l'ordine sbagliato quando il cliente lo sta guardando.
      PUT: async ({ request }) => {
        const no = await guardiaP(request, cors, "impostazioni");
        if (no) return no;
        let body: { ordine?: unknown; firma?: unknown } = {};
        let leggibile = true;
        try { body = (await request.json()) as typeof body; } catch { leggibile = false; }
        if (!leggibile) return json({ ok: false, reason: "corpo_illeggibile" }, 400);
        if (!Array.isArray(body.ordine)) return json({ ok: false, reason: "missing_ordine" }, 400);
        // Nessun client deve poter riordinare alla cieca: senza firma non
        // sappiamo che cosa aveva davanti chi ha spostato la riga.
        const firma = typeof body.firma === "string" ? body.firma.trim() : "";
        if (!firma) return json({ ok: false, reason: "missing_firma" }, 400);
        if (body.ordine.length > MAX_ORDINE) return json({ ok: false, reason: "troppe_voci" }, 400);

        const vera = await readList();
        // La lista è cambiata da un'altra scheda mentre questa aveva l'elenco
        // aperto: si restituisce l'elenco VERO, esattamente come fa la rinomina
        // col not_found, così l'interfaccia si riallinea e chiede di rifare lo
        // spostamento invece di inventarne uno.
        if (firmaDi(vera) !== firma) return conLista(vera, { ok: false, reason: "cambiata" }, 409);
        const perUrl = new Map(vera.map((v) => [v.url, v] as const));

        // Indirizzi utilizzabili, senza ripetizioni: di un url ripetuto vale la
        // prima comparsa, perché è quella che dice dove il consulente l'ha
        // messo (le successive sono rumore, non un secondo media).
        // ⚠️ Il tetto di lunghezza vale solo per gli url che il server NON ha:
        // se un url lunghissimo è già in libreria (il campo "incolla URL"
        // accetta anche un data: in base64, e quello finisce dentro
        // presenter_videos), scartarlo qui non lo cancellerebbe — lo farebbe
        // risultare "non nominato" e quindi lo spedirebbe in cima a ogni
        // singolo riordino, cioè un media che si sposta da solo senza che
        // nessuno l'abbia toccato. Sul resto il tetto non serve nemmeno,
        // perché un url che il server non conosce viene comunque ignorato.
        const chiesti: string[] = [];
        const visti = new Set<string>();
        for (const u of body.ordine) {
          if (typeof u !== "string") continue;
          const url = u.trim();
          if (!url || visti.has(url)) continue;
          if (url.length > MAX_URL && !perUrl.has(url)) continue;
          visti.add(url);
          chiesti.push(url);
        }

        // 1) chiesti che esistono davvero, nell'ordine chiesto;
        const spostati = chiesti.map((u) => perUrl.get(u)).filter((v): v is Vid => !!v);
        // 2) tutto ciò che il client non ha nominato resta, e va IN CIMA nel suo
        //    ordine relativo: l'unico modo in cui una voce è sconosciuta al
        //    client è un POST appena avvenuto, e il POST mette in cima —
        //    rimetterla lì è rimetterla dove chi l'ha caricata la sta cercando.
        const nominati = new Set(spostati.map((v) => v.url));
        const rimasti = vera.filter((v) => !nominati.has(v.url));
        const nuova = [...rimasti, ...spostati];

        // Rete di sicurezza, non decorazione: se questo conto non torna, il
        // ragionamento qui sopra ha un buco e la cosa giusta da fare è NON
        // scrivere. Meglio un riordino perso che una libreria diversa.
        if (nuova.length !== vera.length) return conLista(vera, { ok: false, reason: "riordino_incoerente" }, 500);
        if (!(await writeList(nuova))) return conLista(await readList(), { reason: "scrittura_fallita" }, 500);
        return conLista(nuova);
      },
      DELETE: async ({ request }) => {
        const no = await guardiaP(request, cors, "impostazioni");
        if (no) return no;
        const url = new URL(request.url).searchParams.get("url") || "";
        const list = (await readList()).filter((v) => v.url !== url);
        if (!(await writeList(list))) return conLista(await readList(), { reason: "scrittura_fallita" }, 500);
        return conLista(list);
      },
    },
  },
});
