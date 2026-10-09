/** Preventivo pubblico via link corto.
 *  GET  ?ref=IDP1234            -> dati del preventivo (per /preventivo?id=IDP1234)
 *  POST { ref, password }       -> verifica password di modifica (impostata dal CRM)
 *
 *  ── UN LINK VECCHIO PORTA AL PREVENTIVO NUOVO ─────────────────────────────
 *  Quando il consulente modifica un preventivo già mandato, non lo riscrive:
 *  ne nasce uno nuovo con un numero nuovo (api.presenter.quote-revise) e questo
 *  diventa inattivo. Ma il link con il numero vecchio il cliente ce l'ha già in
 *  chat, ed è quello che riaprirà: se rispondesse ancora con i suoi dati, in
 *  giro resterebbero due prezzi per la stessa persona. Qui il rimando si segue
 *  e si risponde con il preventivo BUONO, dicendo da quale numero si arriva —
 *  così la pagina può aggiornare l'indirizzo senza ricaricare.
 *
 *  ⚠️ E il rimando si cerca SEMPRE, non solo quando la riga risulta sostituita.
 *   Verrebbe voglia di risparmiare quella lettura guardando prima `status` —
 *   ma `status` è un campo che una persona può cambiare dal CRM con la tendina,
 *   anche per sbaglio, e da quel momento il link vecchio tornerebbe a servire il
 *   prezzo vecchio. La validità di un documento non può dipendere da una casella
 *   che si sposta con un clic. È una lettura per chiave primaria, su una rotta
 *   che si apre quando un cliente guarda il suo preventivo: si può pagare.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
//  Le condizioni fotografate quando il preventivo è nato: vedi
//  shop/condizioni-preventivo e la nota su `condizioniDi` qui sotto.
import { BASE_CONDIZIONI } from "@/shop/condizioni-preventivo";
import { BASE_CAUSALE, leggiCausaleSalvata } from "@/shop/causale-di-un-preventivo";
import { normalizzaNumero } from "@/shop/numero-preventivo";
import { chiaveSessione } from "@/shop/chiave-sessione";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

export interface VoceSconto {
  code: string;
  eur: number;
  /** `code` = un codice del listino, di cui si conosce il valore esatto e che
   *  quindi si può anche togliere. `qty` = lo sconto per quantità, confermato
   *  sulla tabella del listino. `altro` = quel che avanza e non si sa spiegare:
   *  si mostra e si porta dietro, ma non si tocca. */
  kind: "code" | "qty" | "altro";
  label?: string;
}

/** ── LO SCONTO, VOCE PER VOCE ──────────────────────────────────────────────
 *  Nella riga del preventivo lo sconto è UN NUMERO SOLO (`discount_eur`) e i
 *  codici sono UNA STRINGA SOLA («VIDEO50, BENVENUTO»). Basta per stampare il
 *  totale; non basta per MODIFICARE il preventivo.
 *
 *  ⚠️ È da qui che nascevano gli sconti sovrapposti. Riaprendo un preventivo
 *   nessuno sapeva più quanto valesse il codice già applicato, quindi quando il
 *   consulente ne metteva un altro l'unica cosa che si poteva fare era
 *   SOMMARLO: il cliente si ritrovava con due promozioni addosso e un prezzo
 *   che non corrispondeva a nessun listino.
 *  Qui i codici si risolvono uno per uno sulla tabella dei codici, e quello che
 *  avanza è lo sconto quantità. Da quel momento togliere un codice è
 *  un'operazione esatta: si sa quanti euro riprendersi.
 *
 *  ⚠️ E se i conti NON tornano si dice fin dove si è arrivati, invece di
 *   inventare il resto. Un codice sparito dal listino, o codici che da soli
 *   valgono più dello sconto scritto: lì non si scompone niente (`null`) e chi
 *   legge torna al numero unico. Ma quando i codici si risolvono e avanza
 *   qualcosa che non si sa spiegare, quel qualcosa resta una voce senza nome —
 *   il codice si può comunque togliere per la cifra esatta che vale, e il resto
 *   non si muove. È la differenza fra «non so scomporre» e «non so scomporre
 *   TUTTO», e sul secondo caso il consulente può lavorare lo stesso. */
async function vociSconto(row: {
  discount_code?: string | null;
  discount_eur?: number | null;
  qty?: number | null;
}): Promise<VoceSconto[] | null> {
  const totale = Math.round((Number(row.discount_eur) || 0) * 100) / 100;
  const qta = Number(row.qty) || 1;

  /** Quello che avanza dopo i codici DOVREBBE essere lo sconto quantità — ma
   *  «dovrebbe» non basta per scriverlo sul documento di un cliente.
   *
   *  ⚠️ QUI SI CONTROLLA, NON SI DEDUCE, e la lezione è arrivata da un
   *   preventivo vero: un codice che all'emissione valeva 1.333,97 € oggi in
   *   tabella ne vale 846,27, e la differenza di 487,70 finiva etichettata
   *   «sconto quantità» su un preventivo da UN impianto — dove uno sconto
   *   quantità non esiste. Una cifra inventata con sopra un'etichetta credibile
   *   è peggio di nessuna scomposizione: il consulente si fida e la toglie.
   *   Quindi il resto si chiama «sconto quantità» SOLO se corrisponde davvero a
   *   quanto il listino sconta per quella quantità. Altrimenti resta una voce
   *   senza nome — che si vede, si porta dietro e non si può togliere. Non
   *   sapere che cos'è non è una buona ragione per farla sparire dal conto. */
  const restante = async (usato: number): Promise<VoceSconto[]> => {
    const resto = Math.round((totale - usato) * 100) / 100;
    if (resto <= 0.005) return [];
    const anonimo: VoceSconto[] = [
      { code: "SCONTO", eur: resto, kind: "altro", label: "sconto già applicato" },
    ];
    const { data } = await supabaseAdmin
      .from("app_config")
      .select("value")
      .eq("key", "qty_discounts")
      .maybeSingle();
    let tabella: Record<string, number> = {};
    try {
      tabella = JSON.parse((data as { value?: string } | null)?.value ?? "{}") || {};
    } catch {
      return anonimo;
    }
    const previsto = Math.round((Number(tabella[String(qta)]) || 0) * 100) / 100;
    if (Math.abs(previsto - resto) > 0.005) return anonimo;
    return [
      {
        code: "QTA",
        eur: resto,
        kind: "qty",
        label: `${qta} ${qta === 1 ? "impianto" : "impianti"}`,
      },
    ];
  };

  const chiesti = String(row.discount_code || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (!chiesti.length) return restante(0);

  //  Un codice con dentro caratteri che non ci si aspetta non si va a cercare:
  //  finirebbe in una condizione di ricerca, non in un confronto.
  if (chiesti.some((c) => !/^[A-Za-z0-9_-]+$/.test(c))) return null;

  //  Ricerca senza distinzione fra maiuscole e minuscole: i codici vecchi
  //  possono essere stati scritti a mano come capitava.
  const { data } = await supabaseAdmin
    .from("discount_codes")
    .select("code,label,discount_eur")
    .or(chiesti.map((c) => `code.ilike.${c}`).join(","));
  type Codice = { code: string; label: string | null; discount_eur: number };
  const trovati = (data as Codice[] | null) ?? [];

  const righe: VoceSconto[] = [];
  let somma = 0;
  for (const c of chiesti) {
    const d = trovati.find((x) => x.code.toUpperCase() === c.toUpperCase());
    if (!d) return null; // di questo codice non si sa più quanto vale
    const eur = Math.round((Number(d.discount_eur) || 0) * 100) / 100;
    somma += eur;
    righe.push({ code: d.code, eur, kind: "code", label: d.label ?? undefined });
  }
  //  I codici da soli valgono più dello sconto scritto sul preventivo: la
  //  scomposizione è impossibile, e fingere di averla fatta sarebbe peggio.
  if (somma > totale + 0.005) return null;
  return [...righe, ...(await restante(somma))];
}

/** ── IL NUMERO DEL PREVENTIVO ──────────────────────────────────────────────
 *  «PREV-2026-0015»: un progressivo leggibile, da dire al telefono e da
 *  scrivere in cima al documento.
 *
 *  ⚠️ NON SOSTITUISCE `quote_ref` (IDQY6EF), e le due cose fanno mestieri
 *   diversi. Il ref è l'INDIRIZZO del preventivo — sta nel link, si detta senza
 *   ambiguità (niente O/0 né I/1) ed è quello che il cliente copia nella
 *   causale del bonifico. Il numero è l'ORDINE in cui i preventivi sono nati, e
 *   serve a chi li conta. Sostituire il primo col secondo vorrebbe dire causali
 *   di bonifico con dentro un numero che si ripete ogni anno.
 *
 *  ⚠️ E NON È UNA SERIE FISCALE. I preventivi non vanno numerati per legge:
 *   qui un buco o un salto non ha nessuna conseguenza. La numerazione che conta
 *   — quella delle fatture — vive altrove (crm/fatture/archivio) e ha regole
 *   tutte sue.
 *
 *  ── SI ASSEGNA UNA VOLTA E SI RILEGGE ────────────────────────────────────
 *  ⚠️ Il progressivo NON si ricalcola a ogni apertura. Derivarlo dal conteggio
 *   dei preventivi più vecchi sarebbe stato più semplice, ma basta cancellarne
 *   uno perché tutti quelli dopo scalino di un posto: il cliente a cui hai
 *   detto «è il PREV-2026-0015» apre il link e ne legge un altro. Si calcola la
 *   prima volta, si scrive in `app_config`, e da lì in poi si legge soltanto. */
async function numeroPreventivo(ref: string, creatoIl: string): Promise<string> {
  //  ⚠️ IL SOLITO CAST, e per il solito motivo: i tipi generati di Supabase in
  //   questo repo non conoscono né `app_config` né i conteggi su
  //   `quote_requests`. Dichiarato una volta qui invece di spargere errori di
  //   compilazione per la funzione.
  const db = supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (
        s: string,
        o?: { count?: "exact"; head?: boolean },
      ) => {
        eq: (
          k: string,
          v: string,
        ) => {
          maybeSingle: () => Promise<{ data: { value?: string | null } | null }>;
        };
        gte: (
          k: string,
          v: string,
        ) => { lte: (k: string, v: string) => Promise<{ count: number | null }> };
      };
      upsert: (v: { key: string; value: string }, o: { onConflict: string }) => Promise<unknown>;
    };
  };
  const chiave = `quote_num:${ref.toUpperCase()}`;
  const { data } = await db.from("app_config").select("value").eq("key", chiave).maybeSingle();
  const salvato = String((data as { value?: string | null } | null)?.value ?? "").trim();
  if (salvato) return salvato;

  const anno = Number(String(creatoIl).slice(0, 4)) || new Date().getFullYear();
  //  Quanti preventivi sono nati in quest'anno prima di questo, lui compreso.
  //  ⚠️ `head: true` chiede solo il CONTEGGIO: senza, si scaricherebbero tutte
  //   le righe dell'anno per contarle nel browser del server.
  const { count } = await db
    .from("quote_requests")
    .select("quote_ref", { count: "exact", head: true })
    .gte("created_at", `${anno}-01-01`)
    .lte("created_at", creatoIl);
  const progressivo = Math.max(1, Number(count) || 1);
  const numero = `PREV-${anno}-${String(progressivo).padStart(4, "0")}`;
  //  Se la scrittura non riesce il numero si mostra lo stesso: è un'etichetta,
  //  non un dato contabile, e alla prossima apertura si riproverà.
  await db.from("app_config").upsert({ key: chiave, value: numero }, { onConflict: "key" });
  return numero;
}

/** Una riga di configurazione, con lo stesso cast del resto del repo:
 *  `app_config` è nata dopo l'ultima generazione dei tipi. */
async function riga(key: string): Promise<string> {
  try {
    const { data } = await (supabaseAdmin.from("app_config" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => PromiseLike<{ data: { value?: string | null } | null }>;
        };
      };
    })
      .select("value")
      .eq("key", key)
      .maybeSingle();
    return String(data?.value ?? "");
  } catch {
    return "";
  }
}

/** La fotografia delle condizioni di un preventivo e la causale scritta a mano
 *  per lui, se ci sono. */
async function accessoriDi(ref: string): Promise<{ condizioni?: string; causale?: string }> {
  const r = String(ref || "").trim();
  if (!r) return {};
  const [cond, caus] = await Promise.all([
    riga(chiaveSessione(BASE_CONDIZIONI, r)),
    riga(chiaveSessione(BASE_CAUSALE, r)),
  ]);
  const modello = leggiCausaleSalvata(caus);
  return { ...(cond ? { condizioni: cond } : {}), ...(modello ? { causale: modello } : {}) };
}

/** ── IL NUMERO È CAMBIATO: IL LINK VECCHIO PORTA LO STESSO DOVE DEVE ──────
 *
 *  Richiesta del committente: «fai che posso cambiare l'ID del preventivo».
 *  Cambiare numero a un documento vuol dire che tutti i link già mandati
 *  citano un numero che nella tabella non c'è più. Qui si segue il rimando
 *  lasciato dal cambio (`quote_rinumerato:<vecchio>`) e si risponde con lo
 *  stesso documento: nessun cartello e nessun avviso, perché non è stato
 *  sostituito da niente — ha solo un altro numero. La pagina si accorge che il
 *  numero restituito è diverso da quello chiesto e sistema da sé l'indirizzo.
 *  ⚠️ CINQUE SALTI E BASTA: un numero cambiato cinque volte è già una cosa da
 *   guardare, e soprattutto un rimando che punta a sé stesso non deve poter
 *   far girare a vuoto una richiesta del cliente. */
async function seguiRinumerazioni(ref: string): Promise<string> {
  let corrente = normalizzaNumero(ref);
  for (let i = 0; i < 5; i++) {
    const raw = await riga(`quote_rinumerato:${corrente}`);
    if (!raw) return corrente;
    let prossimo = "";
    try { prossimo = normalizzaNumero((JSON.parse(raw) as { code?: string })?.code); }
    catch { return corrente; }
    if (!prossimo || prossimo === corrente) return corrente;
    corrente = prossimo;
  }
  return corrente;
}

export const Route = createFileRoute("/api/public/quote")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const chiesto = url.searchParams.get("ref")?.trim();
        if (!chiesto) return json({ ok: false, reason: "missing_ref" }, 400);
        /** ── SEGUIRE IL RIMANDO, OPPURE DIRLO E BASTA ──────────────────────
         *  ⚠️ IL COMPORTAMENTO PREDEFINITO È CAMBIATO, ED È UNA DECISIONE DEL
         *   COMMITTENTE. Prima il vecchio numero portava DENTRO il preventivo
         *   nuovo: si apriva un link salvato in chat e sotto gli occhi
         *   comparivano un altro prezzo e un altro numero. Era difendibile —
         *   quello valido è il nuovo — ma è anche il modo più rapido di far
         *   sentire preso in giro chi sta decidendo come spendere migliaia di
         *   euro: il documento che aveva in mano semplicemente non esisteva più.
         *   Adesso il vecchio numero mostra IL VECCHIO PREVENTIVO, quello che la
         *   persona ricorda, e la pagina gli dice a chiare lettere che è stato
         *   annullato e qual è quello valido.
         *
         *  `segui=1` tiene il vecchio comportamento, e serve ancora: la pagina
         *  del percorso di produzione (/percorso) racconta la lavorazione in
         *  corso, e la lavorazione è quella del preventivo VALIDO — di un
         *  documento annullato non si produce niente.
         *  ⚠️ Chi aggiunge un terzo lettore deve scegliere: «che cosa aveva in
         *   mano questa persona» (senza) oppure «cosa vale adesso» (con). */
        const segui = url.searchParams.get("segui") === "1";

        //  `status` viaggia con gli altri campi perché dice se questa riga è
        //  ancora un documento valido: la pagina lo usa per non presentare come
        //  vivo un preventivo che è stato rifatto.
        const CAMPI =
          "quote_ref,nome,cognome,email,telefono,eta,grey_pct,color_code,problemi,base_choice,base_system,upsells,discount_code,discount_eur,total,qty,fitting_mode,timeline_start,timeline_steps,created_at,status";
        const leggi = (ref: string) =>
          supabaseAdmin.from("quote_requests").select(CAMPI).eq("quote_ref", ref).maybeSingle();

        let { data } = await leggi(chiesto);
        //  ⚠️ Non l'abbiamo trovato: può essere un numero CAMBIATO. Si segue il
        //   rimando prima di rispondere «non esiste» a un cliente che ha in
        //   mano un link che gli abbiamo mandato noi.
        if (!data) {
          const nuovo = await seguiRinumerazioni(chiesto);
          if (nuovo && nuovo !== chiesto.toUpperCase()) ({ data } = await leggi(nuovo));
        }
        if (!data) return json({ ok: false, reason: "not_found" }, 404);

        //  Un preventivo rifatto due volte ha due rimandi in fila, e si seguono
        //  fino in fondo. Cinque passaggi bastano e avanzano — un preventivo
        //  corretto cinque volte è già una cosa da guardare — e soprattutto il
        //  conto non gira a vuoto se un rimando dovesse puntare a sé stesso.
        //
        //  ⚠️ LA CATENA SI PERCORRE SEMPRE, ANCHE SENZA `segui`: serve a sapere
        //   QUAL È il numero valido, che è l'unica cosa utile da dire a chi ha
        //   in mano un documento annullato. Quello che cambia con `segui` è se
        //   il preventivo restituito diventa l'ultimo della catena o resta
        //   quello chiesto.
        let sostituito = false;
        /** L'ultimo numero valido della catena, "" se questo non è stato
         *  sostituito da niente. */
        let valido = "";
        const suoRef = (riga: unknown) =>
          String((riga as { quote_ref?: string })?.quote_ref ?? "").toUpperCase();
        //  Si cammina su `corrente` e non su `data`: senza `segui`, `data` resta
        //  fermo al preventivo chiesto, quindi il passo successivo della catena
        //  va calcolato da un'altra parte — leggendolo da `data` si sarebbe
        //  riletto per cinque volte lo stesso rimando, e il numero valido
        //  sarebbe rimasto il PRIMO della catena invece dell'ultimo.
        let corrente = suoRef(data);
        for (let i = 0; i < 5; i++) {
          const { data: rimando } = await supabaseAdmin
            .from("app_config")
            .select("value")
            .eq("key", `quote_super:${corrente}`)
            .maybeSingle();
          const raw = (rimando as { value?: string | null } | null)?.value ?? "";
          const prossimo = String(raw).trim();
          if (!prossimo || prossimo.toUpperCase() === corrente) break;
          const { data: nuova } = await leggi(prossimo);
          //  Il rimando punta a una riga che non c'è più (preventivo nuovo
          //  cancellato a mano): ci si ferma all'ultimo documento leggibile.
          //  ⚠️ E in quel caso `valido` NON si aggiorna: mandare qualcuno a
          //   cercare un numero che in archivio non esiste è peggio che non
          //   dargli nessun numero.
          if (!nuova) break;
          corrente = suoRef(nuova);
          valido = corrente;
          sostituito = true;
          if (segui) data = nuova;
        }

        //  ── ⚠️ E SE IL VECCHIO DOCUMENTO NON SI DEVE PIÙ LEGGERE ────────
        //   Un preventivo annullato resta consultabile perché è quello che la
        //   persona ricorda, ed è quasi sempre la cosa giusta. Quando non lo è
        //   — un prezzo di prima molto più basso, condizioni che non si vogliono
        //   più far leggere — dai «Preventivi attivi» lo si spegne, e di quel
        //   link resta solo l'avviso col numero valido.
        //   ⚠️ SI CHIEDE SOLO SE SERVE: la lettura in più parte unicamente
        //    quando il preventivo È stato sostituito. Su un preventivo vivo —
        //    cioè su quasi tutte le aperture — non costa niente.
        let soloAvviso = false;
        if (valido) {
          const { data: nascosti } = await supabaseAdmin
            .from("app_config")
            .select("value")
            .eq("key", "quotes_solo_avviso")
            .maybeSingle();
          try {
            const elenco = JSON.parse(
              (nascosti as { value?: string } | null)?.value ?? "[]",
            ) as string[];
            soloAvviso = (elenco || [])
              .map((x) => String(x).toUpperCase())
              .includes(chiesto.toUpperCase());
          } catch {
            //  Elenco illeggibile = si mostra il documento, come si è sempre
            //  fatto: un errore di lettura non deve oscurare un preventivo.
            soloAvviso = false;
          }
        }

        return json({
          ok: true,
          quote: data,
          //  `null` = non si è riusciti a scomporre lo sconto: chi legge usa il
          //  numero unico, come si è sempre fatto, e il pannello del consulente
          //  non offre di togliere un codice che non saprebbe scalare.
          sconti: await vociSconto(data as Parameters<typeof vociSconto>[0]),
          //  Il numero da cui si è arrivati. Esce solo con `segui`, dove il
          //  documento restituito È un altro rispetto a quello chiesto.
          ...(segui && sostituito ? { sostituisce: chiesto.toUpperCase() } : {}),
          //  ⚠️ IL CAMPO CHE PORTA LA NOTIZIA: questo preventivo è stato
          //   annullato, e quello valido è questo. La pagina ci costruisce
          //   l'avviso e il link — senza, mostrerebbe come vivo un documento
          //   che non lo è più.
          ...(valido ? { sostituitoDa: valido } : {}),
          //  ⚠️ Esce solo quando è vero: la pagina distingue «non lo so» da
          //   «no», e un campo sempre presente avrebbe fatto sembrare una
          //   scelta ciò che era solo il valore di partenza.
          ...(soloAvviso ? { soloAvviso: true } : {}),
          /*  ── LE CONDIZIONI DI QUEL GIORNO ──────────────────────────────
              Il listino com'era quando questo preventivo è nato (e le scelte
              fatte, per id). La pagina disegna il documento con questa, non
              con il listino di adesso: un documento consegnato non cambia da
              solo. Esce come TESTO, non già interpretato: chi lo legge ha una
              lettura difensiva sua (`leggiCondizioni`), e due interpretazioni
              della stessa riga sono il modo di vederne due versioni diverse.
              ⚠️ Assente sui preventivi emessi prima di oggi: lì vale il
               listino di adesso, che è come ci si è sempre comportati. */
          ...(await accessoriDi(String((data as { quote_ref?: string }).quote_ref ?? ""))),
          //  Il progressivo leggibile: «PREV-2026-0015». Vedi `numeroPreventivo`.
          numero: await numeroPreventivo(
            String((data as { quote_ref?: string }).quote_ref ?? ""),
            String((data as { created_at?: string }).created_at ?? ""),
          ),
        });
      },

      POST: async ({ request }) => {
        let body: { ref?: string; password?: string } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          /* ignore */
        }
        const password = (body.password ?? "").trim();
        if (!password) return json({ ok: false, reason: "empty" });
        const { data } = await supabaseAdmin
          .from("app_config")
          .select("value")
          .eq("key", "quote_edit_password")
          .maybeSingle();
        const stored = (data as { value?: string | null } | null)?.value ?? "";
        if (!stored) return json({ ok: false, reason: "not_configured" });
        return json({ ok: password === stored });
      },
    },
  },
});
