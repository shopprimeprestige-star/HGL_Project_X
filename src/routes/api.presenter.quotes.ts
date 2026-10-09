/** ELENCO, RICERCA E CANCELLAZIONE DEI PREVENTIVI ────────────────────────────
 *  Serve al presentatore per ritrovare un preventivo già creato e riaprirlo:
 *  finora l'unico modo era avere il numero sotto mano.
 *  GET ?q=testo&limit=30 -> { list: [{ ref, nome, cognome, email, telefono, total, status, created_at }] }
 *  La ricerca guarda numero preventivo, nome, cognome, email e telefono.
 *
 *  ── SOLO A CHI HA L'ACCESSO ───────────────────────────────────────────────
 *  Questa rotta restituisce nome, cognome, telefono ed email di clienti veri di
 *  un centro medico-estetico, più quello che hanno scritto su allergie e
 *  patologie. Fino a ieri rispondeva a CHIUNQUE conoscesse l'indirizzo: nessuna
 *  credenziale, nessun controllo. Adesso serve una sessione da presentatore,
 *  verificata sul server contro il database (vedi api.presenter.consultant);
 *  chi non ce l'ha riceve 401 e nessun dato.
 *
 *  COMPATIBILITÀ: la sessione arriva dal cookie, che il browser manda da solo —
 *  le pagine che oggi chiamano questa rotta non cambiano di una riga, purché il
 *  consulente sia entrato almeno una volta (link magico o PIN). In alternativa
 *  si può passare la credenziale nell'intestazione `x-presenter-code`.
 */
import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chiaveAnteprima } from "./api.anteprima";
//  Che cosa è un numero di preventivo accettabile, e la sua forma normale:
//  vedi shop/numero-preventivo (provato in prove/prove.mjs).
import { normalizzaNumero, perchéNonVa } from "@/shop/numero-preventivo";
//  Le due righe di configurazione che seguono un preventivo: la fotografia
//  delle sue condizioni e la causale scritta a mano per lui.
import { BASE_CONDIZIONI } from "@/shop/condizioni-preventivo";
import { BASE_CAUSALE } from "@/shop/causale-di-un-preventivo";
import { chiaveSessione } from "@/shop/chiave-sessione";
import {
  INTESTAZIONI_CONSENTITE,
  autorizzaPresentatore,
  accessoPresentatore,
  nonAutorizzato,
  vietatoP,
  codiceConsulente,
  presentatoreDaPin,
  chiaviUguali,
  frenoAttesa,
  frenoSbagliato,
  frenoOk,
  attesaLeggibile,
  type SessionePresentatore,
} from "./api.presenter.consultant";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE,
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** ── PERCHÉ LO STESSO CLIENT HA QUI UN SECONDO NOME ────────────────────────
 *  `app_config` e `quote_requests` esistono nel database ma NON nei tipi
 *  generati (src/integrations/supabase/types.ts è fermo a prima delle loro
 *  migrazioni): ogni chiamata diretta fa protestare il compilatore, e il repo
 *  finora l'ha zittito con un `as never` piazzato caso per caso — vedi
 *  api.public.quote-create. Cancellare un preventivo tocca sette chiavi
 *  diverse: con un cast per riga la logica sarebbe sparita sotto la
 *  punteggiatura, quindi il punto di contatto è uno solo ed è questo.
 *  A tempo di esecuzione non cambia niente: è lo STESSO oggetto, cambia solo
 *  quanto ne sa il compilatore.
 */
const db = supabaseAdmin as unknown as SupabaseClient;

/** I preventivi annullati che devono mostrare SOLO l'avviso, senza il vecchio
 *  documento sotto. Stessa forma di `quotes_suspended`: un elenco di ref, non
 *  un campo per riga — così si accende e si spegne senza toccare l'archivio. */
const CHIAVE_SOLO_AVVISO = "quotes_solo_avviso";
/** Il rimando lasciato da un cambio di numero: dal numero vecchio a quello
 *  nuovo. ⚠️ NON è `quote_super`, che vuol dire «sostituito da un altro
 *  documento» e fa comparire il cartello rosso: qui il documento è lo stesso,
 *  ha solo un altro numero, e chi apre il link vecchio non deve accorgersi di
 *  niente. */
export const chiaveRinumerato = (ref: string) => `quote_rinumerato:${normalizzaNumero(ref)}`;
async function leggiSoloAvviso(): Promise<string[]> {
  const { data } = await db.from("app_config").select("value").eq("key", CHIAVE_SOLO_AVVISO).maybeSingle();
  try { return JSON.parse((data as { value?: string } | null)?.value ?? "[]") || []; } catch { return []; }
}

/** ── L'ANTEPRIMA: LE COSE CHE DEVONO RESTARE UGUALI A api.anteprima.ts ─────
 *  La chiave di configurazione la importiamo da lì (`chiaveAnteprima`), così
 *  quella non può divergere. Il contenitore, la ripulitura del codice e il nome
 *  del file no, perché lì non sono esportati: se un giorno cambia il modo di
 *  comporre il percorso, va cambiato QUI uguale.
 *  Se ci si dimentica, però, la cancellazione NON risponde «fatto» lasciando
 *  l'immagine online: il controllo del passo 2 non cerca il nome che si aspetta,
 *  cerca il codice del preventivo dentro i nomi che ci sono davvero — quindi
 *  una divergenza si trasforma in un rifiuto rumoroso, non in una bugia.
 */
const CONTENITORE_ANTEPRIME = "anteprime";
const codiceFile = (v: unknown) => String(v ?? "").trim().replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 64);
const percorsoAnteprima = (codice: string) => `preventivo-${codice}.jpg`;

/** ── COME SI PROVA CHE UN'IMMAGINE NON C'È PIÙ ─────────────────────────────
 *  Non chiedendo «c'è ancora?» file per file — quella domanda risponde «no»
 *  con la stessa faccia sia quando il file è stato tolto sia quando si sta
 *  guardando nel posto sbagliato — ma leggendo l'elenco di quello che c'è
 *  davvero nel contenitore, e cercandoci dentro il codice del preventivo.
 *
 *  Si legge a pagine perché l'elenco può essere lungo, e con un tetto perché
 *  una richiesta non può girare all'infinito. Se il tetto viene raggiunto lo
 *  si DICE (`completo: false`) invece di far finta di aver guardato dappertutto:
 *  chi chiama deve poter distinguere «non c'è» da «non l'ho visto».
 */
const PAGINA = 1000;
const PAGINE_MAX = 20;

/** Il codice dentro il nome di un file depositato: si toglie il tipo davanti
 *  («preventivo-», «invito-») e l'estensione dietro, e quello che resta è il
 *  codice. Solo il PRIMO trattino separa il tipo, perché i codici di consulenza
 *  i trattini ce li hanno dentro («abc-defg-hij»). */
function corpoNome(nome: string): string {
  const i = nome.indexOf("-");
  if (i < 0) return "";
  const punto = nome.lastIndexOf(".");
  return nome.slice(i + 1, punto > i ? punto : undefined);
}
async function nomiDepositati(): Promise<{ nomi: string[]; completo: boolean; errore: string }> {
  const nomi: string[] = [];
  for (let p = 0; p < PAGINE_MAX; p++) {
    const { data, error } = await supabaseAdmin.storage
      .from(CONTENITORE_ANTEPRIME)
      .list("", { limit: PAGINA, offset: p * PAGINA, sortBy: { column: "name", order: "asc" } });
    if (error) return { nomi, completo: false, errore: error.message };
    const pagina = data ?? [];
    for (const f of pagina) {
      const n = String((f as { name?: string }).name ?? "");
      if (n) nomi.push(n);
    }
    if (pagina.length < PAGINA) return { nomi, completo: true, errore: "" };
  }
  return { nomi, completo: false, errore: "" };
}

/** Lettura di una riga di configurazione che distingue «vuota» da «non si è
 *  riuscito a leggerla»: senza questa distinzione un guasto del database
 *  passerebbe per «non c'era niente da pulire», che è il modo più silenzioso
 *  di lasciare indietro un dato. */
async function leggiConfig(key: string): Promise<{ raw: string; errore: string }> {
  const { data, error } = await db.from("app_config").select("value").eq("key", key).maybeSingle();
  if (error) return { raw: "", errore: error.message };
  return { raw: String((data as { value?: string | null } | null)?.value ?? ""), errore: "" };
}
/** Restituisce il messaggio d'errore, oppure stringa vuota se è andata bene. */
async function scriviConfig(key: string, value: string): Promise<string> {
  const { error } = await db.from("app_config").upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  return error ? error.message : "";
}

/** ── CANCELLARE UN PREVENTIVO: L'ELENCO COMPLETO ───────────────────────────
 *  Un preventivo non è una riga: è una riga più una manciata di tracce sparse.
 *  Finora ne sparivano due e la risposta diceva comunque «fatto».
 *
 *  ⚠️ La traccia più importante non è nel database: è un'IMMAGINE PUBBLICA.
 *  L'anteprima che WhatsApp mostra quando il cliente riceve il link porta
 *  disegnati sopra NOME, COGNOME e TOTALE, sta in un contenitore aperto a
 *  chiunque, e il suo indirizzo ce l'ha già in mano chiunque abbia ricevuto il
 *  link. Cancellare la riga e lasciare lì quell'immagine è PEGGIO che non
 *  cancellare niente: chi ha premuto crede di aver tolto il dato del cliente, e
 *  invece è ancora online — e non lo controllerà mai più.
 *
 *  Per questo l'ordine qui sotto non è casuale: PRIMA l'immagine, POI la riga.
 *   · se salta la rimozione dell'immagine ci si ferma prima di toccare la riga,
 *     e non si è perso niente: il preventivo è intatto e si riprova;
 *   · all'inverso, un intoppo qualsiasi lascerebbe la riga sparita e l'immagine
 *     online — cioè esattamente lo stato che non deve poter esistere.
 *
 *  E ogni pulizia mancata finisce in `residui`: la risposta dice `ok` SOLO se
 *  quell'elenco è vuoto. Un «eliminato» che ha lasciato in giro il nome di un
 *  cliente è l'unico errore davvero grave di questa rotta.
 */
async function eliminaPreventivi(refs: string[], autore: string): Promise<Response> {
  const insieme = new Set(refs);
  const residui: string[] = [];
  const avvisi: string[] = [];

  // ── 1. I CODICI DI CONSULENZA, FINCHÉ CI SONO ──────────────────────────
  //  `quote_session:<REF>` conserva il codice della consulenza in cui il
  //  preventivo è nato, ed è il ponte per arrivare alla seconda immagine:
  //  la bozza depositata durante la costruzione, che sta sotto quel codice e
  //  non sotto il numero del preventivo (vedi preventivo.tsx, il deposito a tre
  //  secondi dall'ultima modifica). Va letto adesso, perché fra due passaggi
  //  quella chiave non ci sarà più e la bozza diventerebbe irraggiungibile.
  //
  //  ⚠️ DUE TRAPPOLE, per chi passerà di qui:
  //   1. si leggono SOLO le chiavi `quote_session:<REF>`, mai quella nuda
  //      `quote_session`. Quella è la consulenza in corso ADESSO, che può
  //      benissimo essere di un altro cliente: usarla qui vorrebbe dire
  //      cancellare l'anteprima di una consulenza viva mentre è sullo schermo.
  //   2. oggi `quote_session:<REF>` viene scritta di rado (la scrive
  //      api.presenter.quote-session solo quando il link parte con un `ref`
  //      indicato): per i preventivi che non ce l'hanno la bozza sotto il
  //      codice di consulenza resta irraggiungibile da qui, e va tolta dal
  //      punto in cui viene depositata. Quello che è raggiungibile, qui sotto,
  //      viene tolto per intero — ma non si finga che sia tutto.
  const chiaviSessione = refs.map((r) => `quote_session:${r}`);
  const { data: righeSessione, error: erroreSessione } = await db
    .from("app_config")
    .select("value")
    .in("key", chiaviSessione);
  if (erroreSessione) {
    //  Ci si ferma qui, dove non è ancora stato toccato niente: senza questo
    //  elenco la bozza resterebbe online e nessuno lo saprebbe.
    return json({
      ok: false,
      deleted: 0,
      reason: `Non si riesce a leggere i codici di consulenza (${erroreSessione.message}): non è stato eliminato niente, riprova.`,
    }, 500);
  }
  const codiciSessione = (righeSessione ?? [])
    .map((r) => codiceFile((r as { value?: string | null }).value))
    .filter(Boolean);

  // ── 1-bis. IL SECONDO PONTE: LO SPECCHIO ───────────────────────────────
  //  Lo stato rispecchiato porta insieme il preventivo (`result.ref`) e il
  //  codice della consulenza in cui sta girando (`sess`). Quando il preventivo
  //  che si sta cancellando è proprio quello a specchio — cioè il caso di gran
  //  lunga più frequente: lo si è appena fatto, ci si accorge dell'errore e lo
  //  si butta — quel `sess` è l'altro modo di arrivare alla bozza, l'unico che
  //  funziona anche quando `quote_session:<REF>` non è mai stata scritta.
  //  Si legge QUI, prima di toccare le immagini, e lo stesso valore viene
  //  riusato più sotto per spegnere lo specchio: una lettura sola.
  const specchio = await leggiConfig("quote_state");
  type Specchio = { result?: { ref?: string } | null; sess?: string };
  let snapSpecchio: Specchio | null = null;
  if (specchio.raw) {
    try { snapSpecchio = JSON.parse(specchio.raw) as Specchio; } catch { snapSpecchio = null; }
  }
  const refDelloSpecchio = String(snapSpecchio?.result?.ref ?? "").trim().toUpperCase();
  const specchioDaSpegnere = Boolean(refDelloSpecchio) && insieme.has(refDelloSpecchio);
  if (specchioDaSpegnere) {
    const suo = codiceFile(snapSpecchio?.sess);
    if (suo) codiciSessione.push(suo);
  }

  //  ⚠️ Due preventivi nati nella STESSA consulenza condividono quel codice:
  //  cancellandone uno sparisce la bozza anche all'altro. È una perdita
  //  accettabile — quella è l'immagine del momento in cui il preventivo si
  //  stava costruendo, non l'anteprima del link mandato al cliente, e si rifà
  //  da sé alla prima modifica successiva — ma è giusto che stia scritta qui,
  //  invece di essere scoperta dopo da chi si chiede dov'è finita.
  const codici = [...new Set([...refs.map(codiceFile), ...codiciSessione])].filter(Boolean);
  const chiaviAnteprima = codici.map((c) => chiaveAnteprima("preventivo", c));

  // ── 2. L'IMMAGINE PUBBLICA, PRIMA DI TUTTO IL RESTO ────────────────────
  if (codici.length) {
    const { data: tolti, error: erroreFile } = await supabaseAdmin.storage
      .from(CONTENITORE_ANTEPRIME)
      .remove(codici.map(percorsoAnteprima));

    //  ⚠️ QUI SI GUARDA, NON SI CREDE. «Nessun errore» non vuol dire «tolta»:
    //  questo comando risponde tranquillamente di sì anche quando il
    //  contenitore non esiste proprio, o quando il percorso non corrisponde a
    //  niente — restituisce semplicemente un elenco vuoto di file rimossi.
    //  Fidarsi dell'assenza di errore significherebbe rispondere «eliminato»
    //  mentre l'immagine col nome del cliente è ancora pubblica: esattamente il
    //  guasto che questa rotta esiste per impedire. Quello che fa fede è
    //  l'elenco di ciò che è stato tolto DAVVERO.
    const rimossi = new Set((tolti ?? []).map((f) => String((f as { name?: string }).name ?? "")));

    //  ⚠️ E SI GUARDA PER TUTTI I CODICI, non solo per quelli che risultano
    //  avere un'anteprima. La riga `anteprima:preventivo:<codice>` è solo la
    //  MEMORIA del deposito, e chi deposita (api.anteprima.ts) carica prima il
    //  file e scrive la riga dopo, senza controllare se la scrittura è andata:
    //  basta che quella seconda mossa non riesca — o che qualcuno ripulisca le
    //  righe a mano — e resta un'immagine col nome del cliente di cui il
    //  database non sa più niente. Cercarla solo dove il database dice di
    //  averla messa significa non trovarla proprio nel caso in cui è rimasta
    //  indietro. Nel caso normale l'immagine risulta fra i rimossi e da qui in
    //  giù non si spende una sola chiamata in più.
    const restano = codici.filter((c) => !rimossi.has(percorsoAnteprima(c)));
    const ancoraOnline: string[] = [];
    if (restano.length) {
      //  ⚠️ Prima di credere a un «non c'è», bisogna sapere di aver guardato
      //  nel posto giusto. Se il contenitore non è raggiungibile — nome
      //  sbagliato, permessi cambiati — ogni domanda su un file risponde «non
      //  c'è» con la stessa faccia che avrebbe se fosse stato tolto davvero, e
      //  la cancellazione finirebbe con un «fatto» mentre le immagini sono
      //  tutte ancora al loro posto. È l'unico modo in cui questa rotta
      //  potrebbe mentire senza accorgersene, quindi si chiede esplicitamente.
      const { error: erroreContenitore } = await supabaseAdmin.storage.getBucket(CONTENITORE_ANTEPRIME);
      if (erroreContenitore) {
        console.error(`[QUOTES] ⚠️ contenitore "${CONTENITORE_ANTEPRIME}" non raggiungibile (${erroreContenitore.message}) mentre restano ${restano.length} anteprime da verificare`);
        return json({
          ok: false,
          deleted: 0,
          reason: `Non si riesce a raggiungere lo spazio dove stanno le immagini di anteprima (${erroreContenitore.message}). Il preventivo NON è stato eliminato: riprova, e se insiste avvisa chi gestisce il sistema.`,
        }, 500);
      }

      //  Si legge che cosa c'è DAVVERO nel contenitore. Una sola chiamata (o
      //  poche, se i file sono migliaia) qualunque sia il numero di preventivi
      //  in eliminazione — mentre chiedere file per file costerebbe una
      //  chiamata a testa e, con duecento numeri in una volta, la richiesta
      //  morirebbe per strada lasciando il lavoro a metà.
      const deposito = await nomiDepositati();
      if (deposito.errore) {
        console.error(`[QUOTES] ⚠️ elenco del contenitore illeggibile (${deposito.errore}) con ${restano.length} anteprime da verificare`);
        return json({
          ok: false,
          deleted: 0,
          reason: `Non si riesce a controllare le immagini di anteprima (${deposito.errore}). Il preventivo NON è stato eliminato: riprova.`,
        }, 500);
      }

      //  ⚠️ Non si cerca il nome che ci ASPETTIAMO, si cerca il CODICE dentro i
      //  nomi che ci sono. Il modo in cui si compone il percorso è scritto in
      //  due file diversi (qui e in api.anteprima.ts): il giorno in cui uno dei
      //  due cambia, cercare il nome atteso non troverebbe niente e la risposta
      //  direbbe «eliminato» con l'immagine ancora pubblica. Il codice del
      //  preventivo dentro il nome di un file, invece, resta vero comunque —
      //  e qualunque file lo porti è per costruzione un'immagine di QUESTO
      //  preventivo, quindi va via anche se si chiama in un modo che qui non
      //  era previsto.
      //  Ma il confronto è su TUTTO il pezzo di nome, non «contiene»: qui
      //  dentro stanno anche le anteprime dei biglietti d'invito, e un
      //  «contiene» avrebbe potuto portarsi via l'immagine di un altro per una
      //  somiglianza di lettere. Un file è di questo codice se, tolto il tipo
      //  davanti e l'estensione dietro, resta esattamente il codice.
      const superstiti = deposito.nomi.filter((n) => restano.some((c) => corpoNome(n) === c));
      if (superstiti.length) {
        console.warn(`[QUOTES] anteprime rimaste dopo il primo passaggio, si riprova per nome: ${superstiti.join(", ")}`);
        const { data: tolti2 } = await supabaseAdmin.storage.from(CONTENITORE_ANTEPRIME).remove(superstiti);
        const rimossi2 = new Set((tolti2 ?? []).map((f) => String((f as { name?: string }).name ?? "")));
        ancoraOnline.push(...superstiti.filter((n) => !rimossi2.has(n)));
      }

      //  Il contenitore è più grande di quanto si riesca a scorrere: dei codici
      //  che non sono comparsi non si può dire «non c'è», si può solo dire «non
      //  l'ho visto». Per quei pochi si torna a chiedere file per file; se sono
      //  troppi non si finge di aver controllato — si dice di procedere a
      //  gruppi più piccoli, che è una cosa che chi ha premuto può fare.
      if (!deposito.completo) {
        const nonVisti = restano.filter((c) => !deposito.nomi.some((n) => corpoNome(n) === c));
        if (nonVisti.length > 40) {
          return json({
            ok: false,
            deleted: 0,
            reason: "Sono troppi in una volta per riuscire a controllare che nessuna immagine di anteprima resti online. Il preventivo NON è stato eliminato: riprova selezionandone di meno per volta.",
          }, 500);
        }
        for (const c of nonVisti) {
          const percorso = percorsoAnteprima(c);
          const { data: presente } = await supabaseAdmin.storage.from(CONTENITORE_ANTEPRIME).exists(percorso);
          if (presente === true) ancoraOnline.push(percorso);
        }
      }
    }

    if (ancoraOnline.length) {
      //  Il caso grave: ci si ferma PRIMA di toccare la riga, così il
      //  preventivo resta intatto e si può riprovare da capo. Meglio un
      //  preventivo che non si riesce a cancellare di un preventivo cancellato
      //  a metà, con la faccia del cliente ancora online.
      console.error(`[QUOTES] ⚠️ anteprima ANCORA ONLINE per ${refs.join(", ")}: ${ancoraOnline.join(", ")}${erroreFile ? ` (${erroreFile.message})` : ""}`);
      return json({
        ok: false,
        deleted: 0,
        reason: `L'immagine di anteprima con il nome del cliente è ancora online e non si riesce a toglierla${erroreFile ? ` (${erroreFile.message})` : ""}. Il preventivo NON è stato eliminato: riprova, e se insiste avvisa chi gestisce il sistema.`,
      }, 500);
    }
    if (erroreFile) {
      //  Il comando ha protestato ma di quello che ci interessa non è rimasto
      //  niente online: si prosegue, e lo si dice lo stesso invece di ingoiarlo.
      console.warn(`[QUOTES] contenitore anteprime: ${erroreFile.message} (nessuna immagine risulta però rimasta online)`);
      avvisi.push(`contenitore anteprime: ${erroreFile.message}`);
    }
  }

  // ── 3. IL CARTELLO CHE ANNUNCIA L'IMMAGINE ─────────────────────────────
  //  La chiave senza il file non serve a niente, ma lasciarla significa che
  //  chi serve l'anteprima continua a promettere un indirizzo che ormai è vuoto.
  if (chiaviAnteprima.length) {
    const { error } = await db.from("app_config").delete().in("key", chiaviAnteprima);
    if (error) {
      return json({
        ok: false,
        deleted: 0,
        reason: `L'immagine è stata rimossa ma il suo riferimento no (${error.message}). Il preventivo NON è stato eliminato: riprova.`,
      }, 500);
    }
  }

  // ── 4. LA RIGA DEL PREVENTIVO ──────────────────────────────────────────
  //  Da qui in poi non si torna indietro: quello che non riesce non blocca il
  //  resto, ma finisce in `residui` e la risposta non dirà `ok`.
  const { data: cancellate, error: erroreRiga } = await db
    .from("quote_requests")
    .delete()
    .in("quote_ref", refs)
    .select("quote_ref");
  if (erroreRiga) {
    //  Il messaggio del database non lo si nasconde, ma da solo non dice a chi
    //  legge la cosa che gli serve sapere: il preventivo è ancora lì.
    console.error(`[QUOTES] ⚠️ riga non cancellata per ${refs.join(", ")}: ${erroreRiga.message}`);
    return json({
      ok: false,
      deleted: 0,
      reason: `Il preventivo NON è stato eliminato (${erroreRiga.message}): riprova.`,
    }, 400);
  }
  //  Quanti ne sono stati TROVATI, non quanti ne sono stati chiesti: prima
  //  cancellare un numero inesistente faceva rispondere «1 preventivi eliminati».
  const eliminati = Array.isArray(cancellate) ? cancellate.length : 0;

  // ── 5. LE CHIAVI DEL SINGOLO PREVENTIVO ────────────────────────────────
  //  Le condizioni riaperte (con dentro le note di consulenza) e il codice
  //  della consulenza, che ormai abbiamo già usato.
  const { error: erroreChiavi } = await db
    .from("app_config")
    .delete()
    .in("key", [...refs.map((r) => `quote_edit:${r}`), ...chiaviSessione]);
  if (erroreChiavi) residui.push(`le condizioni riaperte e il codice di consulenza (${erroreChiavi.message})`);

  // ── 6. GLI ELENCHI CONDIVISI ───────────────────────────────────────────
  //  Qui non si cancella la chiave — appartiene anche agli altri preventivi —
  //  si toglie la voce. E si riscrive solo se qualcosa è cambiato davvero:
  //  una scrittura inutile è un'occasione in più di sbagliare.
  const sospesi = await leggiConfig("quotes_suspended");
  if (sospesi.errore) residui.push(`l'elenco delle trattative sospese (${sospesi.errore})`);
  else {
    let cur: unknown[] = [];
    try { cur = (JSON.parse(sospesi.raw || "[]") as unknown[]) || []; } catch { cur = []; }
    const restano = cur.filter((x) => !insieme.has(String(x).trim().toUpperCase()));
    if (restano.length !== cur.length) {
      const e = await scriviConfig("quotes_suspended", JSON.stringify(restano));
      if (e) residui.push(`l'elenco delle trattative sospese (${e})`);
    }
  }

  //  L'attribuzione al consulente: senza questa pulizia la mappa conserverebbe
  //  per sempre il numero del preventivo e il nome di chi l'ha fatto.
  const proprietari = await leggiConfig("quote_owners");
  if (proprietari.errore) residui.push(`l'attribuzione al consulente (${proprietari.errore})`);
  else if (proprietari.raw) {
    let m: Record<string, unknown> = {};
    try { m = (JSON.parse(proprietari.raw) as Record<string, unknown>) || {}; } catch { m = {}; }
    const prima = Object.keys(m).length;
    for (const k of Object.keys(m)) if (insieme.has(k.trim().toUpperCase())) delete m[k];
    if (Object.keys(m).length !== prima) {
      const e = await scriviConfig("quote_owners", JSON.stringify(m));
      if (e) residui.push(`l'attribuzione al consulente (${e})`);
    }
  }

  // ── 7. LO SPECCHIO ─────────────────────────────────────────────────────
  //  `quote_state` è uno solo per tutta l'applicazione, e dentro ci sono nome,
  //  cognome, telefono, età e le note sanitarie: è la copia più esposta di
  //  tutte, perché basta il codice della stanza per leggerla. Si azzera SOLO se
  //  sta rispecchiando proprio uno dei preventivi cancellati — altrimenti si
  //  spegnerebbe lo schermo di una consulenza in corso su un altro cliente.
  //
  //  ⚠️ Si scrive una lapide (`{ ts: adesso }`) invece di cancellare la chiave,
  //  e il motivo sta in api.presenter.quotestate: quella rotta rifiuta le
  //  scritture più VECCHIE di quella memorizzata. Cancellare la chiave
  //  riporterebbe l'orologio a zero, e qualunque scheda rimasta aperta sul
  //  preventivo appena eliminato potrebbe rimetterci dentro il profilo del
  //  cliente. Con un orologio fresco le scritture già partite arrivano vecchie
  //  e vengono scartate da sole.
  //
  //  ⚠️ Fin dove arriva, però, va detto: una scheda ancora aperta che TORNA a
  //  cambiare stato (il consulente ci rimette le mani) scrive con un orario
  //  nuovo, più recente della lapide, e quel profilo torna dentro `quote_state`
  //  — che si legge con il solo codice della stanza. La lapide ferma le
  //  scritture stantie, non una pagina viva. L'unico rimedio vero è che la
  //  pagina del preventivo si accorga di essere stata svuotata e smetta di
  //  trasmettere, e sta in preventivo.tsx, non qui: chi elimina un preventivo
  //  mentre lo ha ancora aperto in un'altra finestra deve chiudere quella
  //  finestra.
  //
  //  Qui si usa quello che è già stato letto al passo 1-bis: rileggerlo adesso
  //  aprirebbe una finestra in cui lo specchio è cambiato sotto i piedi, e si
  //  rischierebbe di spegnere una consulenza cominciata nel frattempo.
  if (specchio.errore) residui.push(`lo specchio del preventivo (${specchio.errore})`);
  else if (specchioDaSpegnere) {
    const e = await scriviConfig("quote_state", JSON.stringify({ ts: Date.now() }));
    if (e) residui.push(`lo specchio del preventivo (${e})`);
  }

  // ── 8. LE REGISTRAZIONI: SI TAGLIA IL FILO, NON IL VIDEO ───────────────
  //  Le registrazioni sono un archivio a sé e si cancellano con un ALTRO
  //  permesso (`registrazioni.tutte`): chi elimina un preventivo non ha chiesto
  //  di buttare via un'ora di videochiamata, e non gliela si butta via da qui.
  //  Si toglie solo il riferimento al preventivo, che ormai punta nel vuoto:
  //  così il pannello smette di accendere «vedi registrazione» su un fantasma e
  //  il numero eliminato non resta scritto dentro un secondo elenco.
  const registrazioni = await leggiConfig("recordings");
  if (registrazioni.errore) residui.push(`il collegamento alle registrazioni (${registrazioni.errore})`);
  else if (registrazioni.raw) {
    let list: { quoteRef?: string }[] = [];
    try { list = (JSON.parse(registrazioni.raw) as { quoteRef?: string }[]) || []; } catch { list = []; }
    let toccate = 0;
    for (const r of list) {
      if (r && insieme.has(String(r.quoteRef ?? "").trim().toUpperCase())) { delete r.quoteRef; toccate++; }
    }
    if (toccate) {
      const e = await scriviConfig("recordings", JSON.stringify(list));
      if (e) residui.push(`il collegamento alle registrazioni (${e})`);
    }
  }

  // ── 9. LA SCHEDA DEL CLIENTE NEL CRM ──────────────────────────────────
  //  La scheda dice «il suo preventivo è <REF>»: se quel preventivo non c'è
  //  più, il rimando va tolto, o la scheda continuerà a mandare a una pagina
  //  vuota chi la apre fra sei mesi.
  //
  //  ⚠️ Le note della trattativa (`notePostCall`) NON si toccano, ed è una
  //  scelta, non una dimenticanza: sono il diario scritto a mano da chi ha
  //  parlato col cliente, accodato apposta per non perdere niente, e cancellare
  //  un preventivo non deve cancellare quello che il cliente ha detto al
  //  telefono. Il numero eliminato sopravvive lì dentro, dentro una frase — ed
  //  è l'unico posto in cui resta, di proposito.
  const { data: schede, error: erroreSchede } = await db
    .from("crm_leads")
    .select("id, data")
    .in("data->>quoteRef", refs);
  if (erroreSchede) residui.push(`il rimando dalla scheda cliente (${erroreSchede.message})`);
  else {
    for (const s of (schede ?? []) as { id: string; data: Record<string, unknown> | null }[]) {
      const d = { ...(s.data ?? {}) };
      delete d.quoteRef;
      const { error } = await db.from("crm_leads").update({ data: d }).eq("id", s.id);
      if (error) residui.push(`il rimando dalla scheda ${s.id} (${error.message})`);
    }
  }

  // ── LA RISPOSTA ────────────────────────────────────────────────────────
  console.log(`[QUOTES] eliminati ${eliminati}/${refs.length} preventivi da ${autore}: ${refs.join(", ")}`);
  if (residui.length) {
    //  Mezza cancellazione. Si dice, e si dice CHE COSA è rimasto: «non
    //  riuscito» senza il dettaglio non permetterebbe a nessuno di rimediare.
    console.error(`[QUOTES] ⚠️ pulizia incompleta su ${refs.join(", ")}: ${residui.join(" · ")}`);
    return json({
      ok: false,
      deleted: eliminati,
      richiesti: refs.length,
      residui,
      //  Con `eliminati === 0` la riga non c'era già più: dire «è stato
      //  eliminato» sarebbe una terza cosa non vera in un messaggio che serve
      //  proprio a raccontare quello che è andato storto.
      reason: `${eliminati > 0 ? "Il preventivo è stato eliminato, ma" : "La riga non c'era più, e"} qualcosa è rimasto indietro: ${residui.join("; ")}. Avvisa chi gestisce il sistema.`,
    }, 500);
  }
  return json({ ok: true, deleted: eliminati, richiesti: refs.length, ...(avvisi.length ? { avvisi } : {}) });
}

export const Route = createFileRoute("/api/presenter/quotes")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      // ── TRATTATIVE SOSPESE ──────────────────────────────────────────────
      //  Un preventivo che non si chiude non va cancellato: va tolto dalla
      //  lista di lavoro e tenuto da parte. L'elenco dei numeri sospesi sta in
      //  una riga sola di configurazione, così un preventivo resta intatto e si
      //  può rimettere in trattativa in qualsiasi momento.
      // ── CANCELLAZIONE IN BLOCCO ─────────────────────────────────────────
      //  Cancellare preventivi è irreversibile e tocca dati di clienti veri:
      //  serve la stessa chiave che autorizza le modifiche, e si registra chi
      //  l'ha fatto nel registro del server.
      POST: async ({ request }) => {
        let b: { action?: string; refs?: string[]; code?: string; on?: boolean; ref?: string; nuovo?: string; causale?: string } = {};
        try { b = (await request.json()) as typeof b; } catch { /* */ }
        //  Vale la sessione del presentatore; il `code` nel corpo resta accettato
        //  perché è quello che le pagine mandano oggi per le azioni delicate.
        //  Il rifiuto ha la stessa forma ovunque (401 + error:"auth"): così il
        //  browser può riconoscere "sessione scaduta" da una risposta sola.
        //  ⚠️ Attenzione a come funziona: con una sessione valida il `code` qui
        //  NON viene guardato. Per la cancellazione — e solo per quella — c'è
        //  un controllo in più poco più sotto, che lo verifica sempre.
        const chi = await autorizzaPresentatore(request, b.code);
        if (!chi) return nonAutorizzato(cors);

        /** ── COSA VEDE CHI APRE UN LINK VECCHIO ────────────────────────
         *  Un preventivo rifatto resta consultabile: il cliente riapre il link
         *  che ha in chat e ritrova il documento che ricorda, con sopra il
         *  riquadro rosso che dice che non vale più. È il modo giusto quasi
         *  sempre — ma non sempre. Se il prezzo di prima era molto più basso,
         *  o se il preventivo era stato fatto su condizioni che non si vogliono
         *  più far leggere, lasciarlo lì in chiaro è un'arma in mano a chi
         *  tratta. Questa azione spegne il documento e lascia solo l'avviso.
         *
         *  ⚠️ SI SPEGNE IL DOCUMENTO, NON IL LINK: chi arriva trova comunque
         *   scritto che quel numero non vale più e QUAL È quello valido, col
         *   pulsante per aprirlo. Un link che non risponde più manderebbe la
         *   persona a chiedere spiegazioni invece che al preventivo nuovo.
         *
         *  ⚠️ SI RIACCENDE: è un interruttore, non una cancellazione. Per
         *   questo è un elenco di ref e non un campo scritto sulla riga —
         *   stessa forma della sospensione, qui accanto, e si legge con lo
         *   stesso codice. */
        if (b.action === "solo-avviso") {
          const refs = (b.refs ?? []).map((r) => String(r).trim().toUpperCase()).filter(Boolean).slice(0, 200);
          if (!refs.length) return json({ ok: false, reason: "nessun preventivo selezionato" }, 400);
          const set = new Set((await leggiSoloAvviso()).map((x) => String(x).toUpperCase()));
          if (b.on === false) refs.forEach((r) => set.delete(r)); else refs.forEach((r) => set.add(r));
          const out = [...set].slice(0, 5000);
          await db.from("app_config").upsert(
            { key: CHIAVE_SOLO_AVVISO, value: JSON.stringify(out), updated_at: new Date().toISOString() },
            { onConflict: "key" },
          );
          console.log(`[QUOTES] ${b.on === false ? "rimostrati" : "nascosti"} ${refs.length} preventivi annullati da ${chi.nome}`);
          return json({ ok: true, soloAvviso: out });
        }

        /** ── CAMBIARE LA CAUSALE A UN PREVENTIVO ───────────────────────
         *  Richiesta del committente: «fai che posso cambiare la causale del
         *  preventivo».
         *  Si salva il MODELLO, non la frase finita: così un preventivo
         *  rinumerato continua a citare il numero giusto, e la stessa riga
         *  vale per la pagina del cliente e per la fattura.
         *  ⚠️ Riga a parte, non dentro la fotografia delle condizioni: quella
         *   porta il listino intero, e scriverci dentro per cambiare una frase
         *   vorrebbe dire rifare la fotografia — cioè rischiare di toccare i
         *   PREZZI di un documento già consegnato. Una riga sola, un solo
         *   effetto. */
        if (b.action === "causale") {
          const ref = normalizzaNumero(b.ref);
          if (!ref) return json({ ok: false, reason: "manca il preventivo" }, 400);
          //  Vuoto = si torna al modello del listino: è il modo di annullare
          //  una causale scritta a mano, e non deve lasciare una riga vuota.
          const modello = String(b.causale ?? "").trim().slice(0, 160);
          const chiave = chiaveSessione(BASE_CAUSALE, ref);
          const errore = modello
            ? await scriviConfig(chiave, JSON.stringify({ modello }))
            : (await db.from("app_config").delete().eq("key", chiave)).error?.message ?? "";
          if (errore) return json({ ok: false, reason: errore }, 500);
          console.log(`[QUOTES] causale di ${ref} ${modello ? "cambiata" : "rimessa come da listino"} da ${chi.nome}`);
          return json({ ok: true, causale: modello });
        }

        /** ── CAMBIARE IL NUMERO A UN PREVENTIVO ────────────────────────
         *  Richiesta del committente: «fai che posso cambiare l'ID del
         *  preventivo».
         *  Quel numero non è un'etichetta: è la chiave con cui il documento si
         *  ritrova dappertutto. Qui si sposta TUTTO quello che gli sta
         *  attaccato, in un colpo solo, e si dice che cosa si è spostato.
         *  ⚠️ IL LINK GIÀ MANDATO CONTINUA A FUNZIONARE: resta una riga di
         *   rimando dal numero vecchio (`quote_rinumerato:<vecchio>`), e chi
         *   apre quel link arriva allo stesso documento — senza cartelli e
         *   senza avvisi, perché non è stato sostituito da niente: ha solo
         *   cambiato numero (vedi api.public.quote).
         *  ⚠️ QUELLO CHE È GIÀ STATO STAMPATO NON CAMBIA: una fattura emessa
         *   cita il numero di allora, e il bonifico che il cliente ha già
         *   fatto porta la vecchia causale. È una cosa da sapere prima di
         *   premere, e il pannello la scrive. */
        if (b.action === "rinumera") {
          const vecchio = normalizzaNumero(b.ref);
          const nuovo = normalizzaNumero(b.nuovo);
          if (!vecchio) return json({ ok: false, reason: "manca il preventivo" }, 400);
          const male = perchéNonVa(nuovo);
          if (male) return json({ ok: false, reason: male }, 400);
          if (vecchio === nuovo) return json({ ok: false, reason: "È già questo il numero." }, 400);

          const { data: riga } = await db.from("quote_requests").select("quote_ref").eq("quote_ref", vecchio).maybeSingle();
          if (!riga) return json({ ok: false, reason: "Preventivo non trovato." }, 404);
          const { data: occupato } = await db.from("quote_requests").select("quote_ref").eq("quote_ref", nuovo).maybeSingle();
          if (occupato) return json({ ok: false, reason: `Il numero ${nuovo} è già di un altro preventivo.` }, 400);
          //  ⚠️ E non deve essere un numero che RIMANDA altrove: chi ha in mano
          //   quel link finirebbe su questo documento credendo di aprire
          //   l'altro.
          const { raw: giaRimando } = await leggiConfig(chiaveRinumerato(nuovo));
          if (giaRimando) return json({ ok: false, reason: `Il numero ${nuovo} è già stato usato e rimanda a un altro preventivo.` }, 400);

          const { error } = await db.from("quote_requests").update({ quote_ref: nuovo }).eq("quote_ref", vecchio);
          if (error) return json({ ok: false, reason: error.message }, 500);

          const spostate: string[] = [];
          //  Le due righe che DEVONO seguire il preventivo: senza la prima il
          //  documento perde le condizioni con cui è nato (prezzi compresi),
          //  senza la seconda perde la causale scritta a mano.
          for (const base of [BASE_CONDIZIONI, BASE_CAUSALE]) {
            const da = chiaveSessione(base, vecchio);
            const { raw } = await leggiConfig(da);
            if (!raw) continue;
            if (!(await scriviConfig(chiaveSessione(base, nuovo), raw))) {
              await db.from("app_config").delete().eq("key", da);
              spostate.push(base);
            }
          }
          //  L'anteprima del link si COPIA e non si sposta: il link vecchio
          //  esiste ancora (rimanda qui), e chi lo rimanda su WhatsApp deve
          //  continuare a vedere il riquadro.
          const { raw: ant } = await leggiConfig(chiaveAnteprima("preventivo", vecchio));
          if (ant) await scriviConfig(chiaveAnteprima("preventivo", nuovo), ant);
          //  Il ponte verso la bozza depositata durante la costruzione: se
          //  resta col numero vecchio, una cancellazione futura non la trova
          //  più e quell'immagine resta online per sempre.
          const { raw: sess } = await leggiConfig(`quote_session:${vecchio}`);
          if (sess) {
            await scriviConfig(`quote_session:${nuovo}`, sess);
            await db.from("app_config").delete().eq("key", `quote_session:${vecchio}`);
          }
          //  Gli elenchi: sospesi e «solo avviso» sono fatti di numeri, e un
          //  preventivo sospeso deve restare sospeso anche col numero nuovo.
          for (const chiaveElenco of [CHIAVE_SOLO_AVVISO, "quotes_suspended"]) {
            const { raw } = await leggiConfig(chiaveElenco);
            if (!raw) continue;
            try {
              const dentro = (JSON.parse(raw) as string[]) || [];
              if (!dentro.some((x) => normalizzaNumero(x) === vecchio)) continue;
              const fuori = dentro.map((x) => (normalizzaNumero(x) === vecchio ? nuovo : x));
              await scriviConfig(chiaveElenco, JSON.stringify(fuori));
            } catch { /* elenco illeggibile: si lascia com'è */ }
          }
          //  La scheda del cliente: `data.quoteRef` è il legame con cui il CRM
          //  ritrova il preventivo (e con cui la fattura lo cita).
          let schede = 0;
          try {
            const { data: leads } = await db.from("crm_leads").select("id,data").eq("data->>quoteRef", vecchio);
            for (const l of (leads ?? []) as { id: string; data: Record<string, unknown> }[]) {
              const { error: e2 } = await db.from("crm_leads").update({ data: { ...l.data, quoteRef: nuovo } }).eq("id", l.id);
              if (!e2) schede += 1;
            }
          } catch { /* niente scheda collegata: non è un errore */ }

          //  Il rimando, per ultimo: da qui in poi il link vecchio funziona.
          await scriviConfig(chiaveRinumerato(vecchio), JSON.stringify({ code: nuovo, il: new Date().toISOString() }));
          console.log(`[QUOTES] ${vecchio} → ${nuovo} (righe spostate: ${spostate.join(", ") || "nessuna"}, schede: ${schede}) da ${chi.nome}`);
          return json({ ok: true, ref: nuovo, schede });
        }

        if (b.action === "suspend") {
          const refs = (b.refs ?? []).map((r) => String(r).trim().toUpperCase()).filter(Boolean).slice(0, 200);
          if (!refs.length) return json({ ok: false, reason: "nessun preventivo selezionato" }, 400);
          const { data } = await db.from("app_config").select("value").eq("key", "quotes_suspended").maybeSingle();
          let cur: string[] = [];
          try { cur = JSON.parse((data as { value?: string } | null)?.value ?? "[]") || []; } catch { /* */ }
          const set = new Set(cur.map((x) => String(x).toUpperCase()));
          if (b.on === false) refs.forEach((r) => set.delete(r)); else refs.forEach((r) => set.add(r));
          const out = [...set].slice(0, 5000);
          await db.from("app_config").upsert(
            { key: "quotes_suspended", value: JSON.stringify(out), updated_at: new Date().toISOString() },
            { onConflict: "key" },
          );
          console.log(`[QUOTES] ${b.on === false ? "riattivati" : "sospesi"} ${refs.length} preventivi da ${chi.nome}`);
          return json({ ok: true, suspended: out });
        }
        if (b.action !== "delete") return json({ ok: false, reason: "azione sconosciuta" }, 400);

        //  ── SE UN PIN È STATO DIGITATO, QUEL PIN VA CONTROLLATO ──────────
        //  ⚠️ Qui c'era una bugia, e stava tutta in una riga più in su:
        //  `autorizzaPresentatore` prova PRIMA il cookie di sessione e solo in
        //  sua mancanza guarda il `code` del corpo. Ma per vedere l'elenco dei
        //  preventivi una sessione ci vuole per forza (la GET la pretende),
        //  quindi quando il pannello chiedeva il PIN prima di cancellare quel
        //  PIN non veniva MAI verificato: andava bene qualunque cosa, anche
        //  quattro cifre a caso. Il riquadro prometteva un secondo controllo
        //  che non esisteva — ed è la promessa peggiore da non mantenere,
        //  perché fa premere ELIMINA con più tranquillità, non con meno.
        //  Adesso: se il corpo porta un codice, o è buono o non si cancella; ed
        //  è QUELLA la persona che si assume la cancellazione, perché è la
        //  credenziale che qualcuno ha appena digitato davanti al riquadro.
        //  Chi non ne manda nessuno resta autorizzato dalla sua sessione, come
        //  prima: nessun'altra pagina cambia comportamento.
        let autore = chi;
        const digitato = String(b.code ?? "").trim();
        if (digitato) {
          //  Lo stesso freno dell'ingresso: senza, questa diventerebbe una
          //  seconda porta su cui provare i PIN a raffica — e chi ci prova qui
          //  è già dentro, quindi cercherebbe il PIN di QUALCUN ALTRO, cioè
          //  esattamente i permessi che a lui mancano.
          const attesa = await frenoAttesa(request);
          if (attesa) {
            return json({ ok: false, error: "freno", reason: `Troppi tentativi: riprova fra ${attesaLeggibile(attesa)}.` }, 429);
          }
          let riconosciuto: SessionePresentatore | null = null;
          if (chiaviUguali(digitato, await codiceConsulente())) {
            riconosciuto = { id: "", nome: "codice consulente", via: "codice" };
          } else {
            const p = await presentatoreDaPin(digitato);
            if (p) riconosciuto = { id: p.id, nome: p.nome, via: "pin" };
          }
          if (!riconosciuto) {
            await frenoSbagliato(request);
            //  `error: "auth"` + questo motivo sono la forma che il pannello
            //  riconosce per rimettere a schermo il campo del PIN.
            return json({ ok: false, error: "auth", reason: "codice non valido" }, 401);
          }
          await frenoOk(request);
          autore = riconosciuto;
        }

        //  ── CANCELLARE NON È LAVORO DA CONSULENTE ────────────────────────
        //  Sospendere è reversibile e serve tutti i giorni; cancellare no, e
        //  qui dentro ci sono i dati di clienti veri. Duecento preventivi via
        //  con una richiesta sola: serve il permesso di cancellare.
        if (!(await accessoPresentatore(autore)).puo("lead.elimina")) return vietatoP(cors, "lead.elimina");
        const chiesti = (b.refs ?? []).map((r) => String(r).trim().toUpperCase()).filter(Boolean);
        if (!chiesti.length) return json({ ok: false, reason: "nessun preventivo selezionato" }, 400);
        //  ⚠️ Oltre il tetto si RIFIUTA, non si taglia: tagliare in silenzio
        //  voleva dire rispondere «fatto» a chi ne aveva chiesti duecentocinque
        //  e lasciarne vivi cinque che quella persona crede spariti.
        if (chiesti.length > 200) {
          return json({ ok: false, reason: `Sono troppi in una volta (${chiesti.length}): non è stato eliminato niente. Riprova a gruppi di 200 al massimo.` }, 400);
        }
        const refs = [...new Set(chiesti)];
        return await eliminaPreventivi(refs, autore.nome);
      },
      GET: async ({ request }) => {
        //  ── LA PORTA ──────────────────────────────────────────────────────
        //  Prima di leggere una sola riga: chi sta chiedendo? Senza risposta,
        //  401 e basta. `list` e `suspended` vuoti tengono la forma che il
        //  pannello si aspetta, così una sessione scaduta lo lascia vuoto
        //  invece di romperlo.
        const chi = await autorizzaPresentatore(request);
        if (!chi) return nonAutorizzato(cors, { list: [], suspended: [] });

        const u = new URL(request.url);
        const q = (u.searchParams.get("q") || "").trim();
        const limit = Math.min(60, Math.max(1, Number(u.searchParams.get("limit")) || 30));
        try {
          //  `status` viaggia con l'elenco per un motivo solo, e non è
          //  decorativo: nel pannello «prova fatta per sbaglio» e «cliente che
          //  ha versato l'acconto» hanno esattamente lo stesso aspetto. Chi sta
          //  per cancellare deve poter sapere quale delle due ha davanti PRIMA
          //  di premere — la tassonomia dei valori sta in CRM.preventivi.tsx.
          let query = db
            .from("quote_requests")
            .select("quote_ref, nome, cognome, email, telefono, total, qty, created_at, problemi, eta, status")
            .order("created_at", { ascending: false })
            .limit(limit);
          if (q) {
            // una sola ricerca su tutti i campi utili: il presentatore digita
            // quello che ha (un pezzo di nome, il telefono, il numero…)
            // I caratteri che PostgREST usa per separare i filtri vanno tolti:
            //  una virgola nel testo cercato spezzava la query in due condizioni.
            const pulito = q.replace(/[,()*"\\]/g, " ").trim();
            if (!pulito) return json({ list: [] });
            const like = `%${pulito}%`;
            query = query.or(
              `quote_ref.ilike.${like},nome.ilike.${like},cognome.ilike.${like},email.ilike.${like},telefono.ilike.${like}`,
            );
          }
          const { data, error } = await query;
          if (error) return json({ list: [], error: error.message });
          const { data: sus } = await db.from("app_config").select("value").eq("key", "quotes_suspended").maybeSingle();
          let suspended: string[] = [];
          try { suspended = JSON.parse((sus as { value?: string } | null)?.value ?? "[]") || []; } catch { /* */ }
          return json({ list: data ?? [], suspended, soloAvviso: await leggiSoloAvviso() });
        } catch (e) {
          return json({ list: [], error: String(e) });
        }
      },
    },
  },
});
