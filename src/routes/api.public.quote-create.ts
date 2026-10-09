/** SALVA UN PREVENTIVO ────────────────────────────────────────────────────────
 *  POST { row }  ->  { ok: true, ref }   |   { ok: false, reason }
 *
 *  PERCHÉ ESISTE, invece di scrivere dal browser com'era prima.
 *  Il preventivo veniva inserito direttamente dal browser con la chiave
 *  pubblica, e la scrittura passava quindi per le regole di riga del database.
 *  Quando quelle regole rifiutavano — e rifiutavano — il codice del browser
 *  faceva `break` e mostrava comunque il preventivo al consulente: il numero
 *  compariva a schermo, il cliente lo vedeva, e nell'archivio non c'era niente.
 *  Un preventivo perso non fa rumore: lo si scopre giorni dopo, cercandolo.
 *
 *  Qui la scrittura la fa il server con la chiave di servizio, quindi le regole
 *  di riga non c'entrano più, e SOPRATTUTTO l'esito torna indietro: se non si è
 *  salvato, il consulente lo sa mentre ha ancora il cliente davanti.
 *
 *  Il numero (`quote_ref`) lo sceglie il browser, che è dove il preventivo è
 *  nato e dove il numero è già stato mostrato. Se quel numero risultasse già
 *  preso, il server ne genera uno nuovo e lo restituisce: il browser usa quello.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
/*  ── LE CONDIZIONI CON CUI IL PREVENTIVO NASCE ────────────────────────────
    Richiesta del committente: «se un preventivo lo faccio con le opzioni
    accese o con determinati prezzi, rimangono quei prezzi e quelle
    impostazioni». Il listino di quel momento e le scelte fatte si salvano
    accanto al documento, in una riga di `app_config` — non in una colonna
    nuova: aggiungerne una vuol dire una migrazione su un archivio con dentro
    le vendite di un'azienda, e non è una cosa da fare di iniziativa propria
    (è la stessa scelta di shop/garanzia-codici).
    ⚠️ SI SCRIVE DOPO L'INSERIMENTO e con il numero DEFINITIVO: il server può
     aver dovuto cambiarlo, e una fotografia intestata al numero sbagliato non
     la ritroverebbe nessuno.
    ⚠️ E NON FA FALLIRE NIENTE: se questa scrittura non riesce, il preventivo
     è salvato lo stesso e la pagina si comporterà come prima di oggi (listino
     di adesso). Perdere il documento per una fotografia sarebbe assurdo. */
import { BASE_CONDIZIONI } from "@/shop/condizioni-preventivo";
/*  ── ⚠️ UNA ROTTA APERTA SCRIVE SOLO QUELLO CHE DEVE ──────────────────────
    Questa rotta non ha credenziali e non può averne: il preventivo lo crea la
    pagina del cliente. Fin qui però prendeva il corpo della richiesta e lo
    infilava nella tabella così com'era — chiunque conoscesse l'indirizzo
    poteva scrivere nell'archivio quello che voleva, nei campi che voleva.
    `rigaPulita` lascia passare i campi previsti, accorcia i testi, tiene i
    numeri dentro limiti sensati e decide lo stato. Non è una serratura: è la
    differenza fra «scrivi quello che vuoi» e «scrivi un preventivo». */
import { rigaPulita } from "@/shop/riga-preventivo";
import { chiaveSessione } from "@/shop/chiave-sessione";
import { attesoDalGettone, chiaveAttesi, leggiAttesi } from "@/crm/fascia-consulenza";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** Le stesse lettere e cifre usate dal browser: niente O/0 né I/1, perché un
 *  numero di preventivo si detta al telefono. */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function nuovoRef(): string {
  let s = "";
  const b = new Uint32Array(4);
  crypto.getRandomValues(b);
  for (let i = 0; i < 4; i++) s += ALFABETO[b[i] % ALFABETO.length];
  return `IDP${s}`;
}

/** ── QUANTI PREVENTIVI PUÒ CREARE UNO STESSO INDIRIZZO ────────────────────
 *  Venti al minuto: una consulenza vera ne fa uno, due se si corregge; un
 *  ciclo automatico ne fa mille. La finestra scorre e la memoria si pulisce da
 *  sola, così l'elenco non cresce per sempre dentro un server che vive ore. */
const FINESTRA_MS = 60_000;
const MAX_AL_MINUTO = 20;
const visti = new Map<string, number[]>();
function troppeRichieste(chi: string): boolean {
  const ora = Date.now();
  const miei = (visti.get(chi) ?? []).filter((t) => ora - t < FINESTRA_MS);
  miei.push(ora);
  visti.set(chi, miei);
  if (visti.size > 500) for (const [k, v] of visti) if (!v.some((t) => ora - t < FINESTRA_MS)) visti.delete(k);
  return miei.length > MAX_AL_MINUTO;
}

/** La fotografia delle condizioni, accanto al preventivo appena nato. */
async function salvaCondizioni(ref: string, condizioni: unknown): Promise<void> {
  if (!condizioni || typeof condizioni !== "object") return;
  try {
    await supabaseAdmin.from("app_config").upsert(
      {
        key: chiaveSessione(BASE_CONDIZIONI, ref),
        value: JSON.stringify(condizioni),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
  } catch {
    /* il preventivo è salvato: questa è una rifinitura, non un requisito */
  }
}

/** ── IL PREVENTIVO SI ATTACCA DA SOLO ALLA SCHEDA DEL CLIENTE ─────────────
 *
 *  Misurato in archivio: su 71 preventivi solo 19 avevano il legame con la
 *  scheda (`data.quoteRef`). Lo scrive `api.crm.lead-sync`, ma solo quando la
 *  pagina del preventivo SA di quale scheda si tratta — cioè quando il
 *  consulente è passato dalla scheda. Aprendo /preventivo a mano, o
 *  compilandolo il cliente da solo, quel legame non nasce mai.
 *
 *  Conseguenza vera, non teorica: la fattura cercava il preventivo in quel
 *  campo soltanto, e per tre fatture su quattro usciva senza numero — cioè
 *  senza il filo che lega il bonifico del cliente al documento. (L'altra metà
 *  del rimedio è in crm/preventivi/dati: la fattura adesso ripiega sul
 *  telefono. Qui si fa in modo che il ripiego serva sempre meno.)
 *
 *  ⚠️ SI SCRIVE SOLO SE C'È UN SOLO CANDIDATO. Un numero di telefono può stare
 *   su più schede — famiglie, doppioni di import — e attaccare il preventivo
 *   alla scheda sbagliata vorrebbe dire guardare lo stato di un'altra persona.
 *   Nel dubbio non si scrive niente: resta il ripiego della fattura, che il
 *   dubbio lo dichiara a chi emette.
 *  ⚠️ E NON SI SOVRASCRIVE UN LEGAME ESISTENTE: se la scheda dichiara già un
 *   preventivo, quello l'ha scelto qualcuno. I preventivi più vecchi la
 *   scheda li ritrova comunque dal telefono.
 *  ⚠️ NON PUÒ FAR FALLIRE LA CREAZIONE: il preventivo è già salvato, questa è
 *   una rifinitura. Qualunque cosa vada storta qui, si tace. */
async function agganciaAllaScheda(ref: string, telefono: string): Promise<void> {
  const cifre = telefono.replace(/\D/g, "").slice(-9);
  if (cifre.length < 9) return;
  try {
    /*  ⚠️ SI LEGGONO DUE CAMPI, NON LE SCHEDE INTERE: qui dentro c'è tutto il
        CRM, e tirarselo dietro a ogni preventivo creato sarebbe qualche mega
        per una domanda da nove cifre.
        ⚠️ E SI LEGGE A PAGINE. Il server taglia a mille righe qualunque
         `limit` più grande (misurato: `limit=3000` → 1000 righe su 1031
         schede). Senza le pagine, le schede oltre la millesima non esistono:
         l'aggancio salterebbe proprio i clienti più vecchi, e — peggio — un
         secondo candidato fuori dalla finestra non si vedrebbe, facendo
         sembrare CERTO un aggancio che è ambiguo. */
    const PAGINA = 1000;
    const righe: { id: string; tel: string | null; rif: string | null }[] = [];
    for (let p = 0; p < 20; p++) {
      const { data } = await supabaseAdmin
        .from("crm_leads")
        .select("id,tel:data->>telefono,rif:data->>quoteRef")
        .range(p * PAGINA, p * PAGINA + PAGINA - 1);
      const blocco = (data ?? []) as unknown as { id: string; tel: string | null; rif: string | null }[];
      righe.push(...blocco);
      if (blocco.length < PAGINA) break;
    }
    const candidati = righe.filter(
      (l) => String(l.tel ?? "").replace(/\D/g, "").slice(-9) === cifre,
    );
    if (candidati.length !== 1) return;
    const scheda = candidati[0];
    if (String(scheda.rif ?? "").trim()) return;
    //  ⚠️ La scheda si rilegge intera solo adesso, per non perdere niente di
    //   quello che c'è dentro: `data` è un oggetto solo, e scriverne una copia
    //   parziale cancellerebbe il resto della scheda.
    await scriviIlLegame(scheda.id, ref, "telefono");
  } catch {
    /* il preventivo è salvato: l'aggancio è una rifinitura */
  }
}

/** Scrive `data.quoteRef` sulla scheda, senza perdere il resto e senza
 *  sovrascrivere un legame che c'è già. */
async function scriviIlLegame(leadId: string, ref: string, come: string): Promise<void> {
  //  ⚠️ La scheda si rilegge INTERA: `data` è un oggetto solo, e scriverne una
  //   copia parziale cancellerebbe il resto della scheda.
  const { data: piena } = await supabaseAdmin.from("crm_leads").select("data").eq("id", leadId).maybeSingle();
  const dentro = ((piena as { data?: Record<string, unknown> } | null)?.data ?? {}) as Record<string, unknown>;
  if (String(dentro.quoteRef ?? "").trim()) return;
  const { error } = await supabaseAdmin
    .from("crm_leads")
    .update({ data: { ...dentro, quoteRef: ref } } as never)
    .eq("id", leadId);
  if (!error) console.log(`[PREVENTIVO] ${ref} agganciato da solo alla scheda ${leadId} (${come})`);
}

/** ── IL PREVENTIVO DI UNA CONSULENZA DI GRUPPO SA GIÀ DI CHI È ────────────
 *
 *  Quando tre persone compilano ciascuna il proprio preventivo nella stessa
 *  consulenza, indovinare la scheda dal telefono è la strada peggiore: i tre
 *  numeri possono mancare, essere uguali (una famiglia) o essere scritti a
 *  mano male, e un preventivo attaccato alla scheda sbagliata fa leggere a un
 *  cliente lo stato di un altro.
 *  Qui la risposta c'è già: chi compila ha scelto il proprio nome
 *  all'ingresso, e porta con sé il GETTONE della sua scheda. Il gettone da
 *  solo non dice niente — l'id della scheda non esce mai dal server — ma
 *  dentro la stanza della consulenza si traduce in una persona sola.
 *
 *  ⚠️ IL GETTONE VALE SOLO NELLA SUA STANZA: si cerca fra gli attesi di
 *   QUELLA consulenza, e fuori non apre niente. È lo stesso patto di
 *   `gettoneDi` (crm/fascia-consulenza).
 *  ⚠️ E QUESTA STRADA VIENE PRIMA DEL TELEFONO: è dichiarata, non indovinata. */
async function agganciaAlGettone(ref: string, sess: string, gettone: string): Promise<boolean> {
  if (!sess.trim() || !gettone.trim()) return false;
  try {
    const { data } = await supabaseAdmin
      .from("app_config")
      .select("value")
      .eq("key", chiaveAttesi(sess))
      .maybeSingle();
    const chi = attesoDalGettone(
      leggiAttesi((data as { value?: string | null } | null)?.value ?? null),
      gettone,
    );
    if (!chi) return false;
    await scriviIlLegame(chi.leadId, ref, "gettone della consulenza");
    return true;
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/quote-create")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        let body: { row?: Record<string, unknown>; condizioni?: unknown; sess?: string; persona?: string } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ ok: false, reason: "corpo della richiesta illeggibile" }, 400);
        }
        const grezza = body.row;
        if (!grezza || typeof grezza !== "object") return json({ ok: false, reason: "nessun preventivo" }, 400);
        //  ── ⚠️ UN ARGINE, NON UNA SERRATURA ──────────────────────────────
        //   Tenere il conto in memoria vale per QUESTA istanza del server e
        //   si azzera quando Cloudflare la ricicla: ferma il flusso automatico
        //   (mille richieste al minuto da un indirizzo), non l'attacco
        //   studiato. Il vero controllo è `rigaPulita`. Sta qui e non in
        //   database perché un contatore scritto a ogni richiesta sarebbe un
        //   costo pagato da tutti per colpa di nessuno.
        const chi = request.headers.get("cf-connecting-ip") || "ignoto";
        if (troppeRichieste(chi)) return json({ ok: false, reason: "troppe richieste, riprova fra un minuto" }, 429);

        const { riga: row, scartati } = rigaPulita(grezza);
        if (scartati.length) console.warn("[QUOTE-CREATE] campi non previsti, scartati:", scartati.join(", "));

        let ref = String((grezza as { quote_ref?: unknown }).quote_ref || "").trim() || nuovoRef();

        //  Otto tentativi: solo per il caso — raro — in cui il numero sorteggiato
        //  sia già in uso. Ogni altro errore si ferma subito e TORNA INDIETRO,
        //  invece di essere ingoiato.
        for (let i = 0; i < 8; i++) {
          const { error } = await supabaseAdmin
            .from("quote_requests")
            .insert({ ...row, quote_ref: ref } as never);

          if (!error) {
            await salvaCondizioni(ref, body.condizioni);
            //  Prima la strada dichiarata (chi ha compilato ha detto chi è),
            //  poi — solo se non c'era — quella indovinata dal telefono.
            const suo = await agganciaAlGettone(ref, String(body.sess ?? ""), String(body.persona ?? ""));
            if (!suo) await agganciaAllaScheda(ref, String((row as { telefono?: unknown }).telefono ?? ""));
            return json({ ok: true, ref });
          }

          // 23505 = numero già esistente: se ne prende un altro e si riprova.
          if (error.code === "23505") {
            ref = nuovoRef();
            continue;
          }
          return json({ ok: false, reason: error.message, ref }, 500);
        }
        return json({ ok: false, reason: "non è stato possibile assegnare un numero" }, 500);
      },
    },
  },
});
