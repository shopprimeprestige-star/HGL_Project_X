/** SOSTITUIRE UN PREVENTIVO GIÀ EMESSO ───────────────────────────────────────
 *  POST { ref, code, by?, qty?, promoDays?, extraEur?, addCodes?, totali }
 *       -> { ok: true, ref: <NUOVO>, quote }   |   { ok: false, reason }
 *
 *  ── PERCHÉ ESISTE, E PERCHÉ NON BASTAVA quote-edit ────────────────────────
 *  Fino a ieri una modifica fatta col PIN non riscriveva niente: finiva in
 *  `app_config['quote_edit:<REF>']`, e il prezzo vero si otteneva sommando la
 *  riga del preventivo più quella modifica AL MOMENTO DELLA LETTURA. Da quel
 *  meccanismo discendevano tre guasti che sembravano tre problemi diversi:
 *
 *   · il prezzo VECCHIO che lampeggiava sulla pagina — prima si legge la riga,
 *     poi si applica la modifica, e per un istante il cliente vede la cifra di
 *     prima;
 *   · l'anteprima di WhatsApp SBAGLIATA — quella si disegna fuori dal browser,
 *     dove quella somma non avviene mai: mostrava il prezzo pieno;
 *   · due prezzi in circolazione sullo stesso cliente, perché il link già
 *     mandato continuava a essere un documento valido.
 *
 *  Qui la modifica non si affianca al preventivo: ne fa NASCERE UNO NUOVO, con
 *  un numero nuovo e i valori già dentro la riga. Quello vecchio diventa
 *  inattivo (`status: 'sostituito'`) e il suo indirizzo porta al nuovo — così
 *  chi ha in mano il link di ieri legge il prezzo di oggi, e in giro resta una
 *  cifra sola.
 *
 *  ── LE OPZIONI SI COPIANO QUI, NON LE RIMANDA IL BROWSER ──────────────────
 *  Sistema scelto, voci, contatti, dati clinici, modalità di rilievo misure e
 *  passaggi del percorso vengono ripresi dalla riga vecchia SUL SERVER. Il
 *  consulente non deve ricostruire niente a mano, e nessun campo può perdersi
 *  per strada perché il browser non lo aveva in memoria.
 *
 *  ── CHI DECIDE I NUMERI ───────────────────────────────────────────────────
 *  I totali arrivano dal browser, come già succede alla creazione
 *  (api.public.quote-create): il conto — sconto quantità, analisi in sede che
 *  si paga una volta sola, codici — vive in `withEdit` di routes/preventivo.tsx
 *  ed è quello che il cliente sta guardando mentre si preme il pulsante.
 *  Rifarlo qui vorrebbe dire tenerne due copie, e due copie divergono sempre:
 *  il giorno in cui divergono, il preventivo scritto in archivio non è più
 *  quello mostrato al cliente.
 *  Quello che il server NON si fa dire è il VALORE DI UNO SCONTO: i codici si
 *  rileggono dalla tabella (attivo? esaurito?) esattamente come in quote-edit,
 *  e uno sconto deciso a mano o una scadenza allungata restano lavoro da
 *  permesso «listino».
 */
import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
//  Le impostazioni di fatturazione (l'aliquota) e lo scorporo: gli stessi che
//  usano il CRM e la rotta che crea le bozze — una seconda copia del conto
//  darebbe due imponibili diversi per lo stesso importo.
import { archivioSu, leggiAziendaSu } from "@/crm/fatture/archivio";
import { contoDaLordo } from "@/crm/fatture/conti";
import { buildMenu, vociAiPrezziDiOggi } from "@/shop/quote-menu";
import { idAmbito } from "@/shop/ambito-listino";
import { listinoDi } from "@/crm/listino-di-chi.server";
import {
  INTESTAZIONI_CONSENTITE,
  accessoPresentatore,
  autorizzaPresentatore,
  nonAutorizzato,
  vietatoP,
} from "./api.presenter.consultant";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE,
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** Stesso motivo di api.presenter.quotes: `quote_requests` e `app_config` non
 *  stanno nei tipi generati, e un cast per riga farebbe sparire la logica sotto
 *  la punteggiatura. A tempo di esecuzione è lo stesso oggetto. */
const db = supabaseAdmin as unknown as SupabaseClient;

/** Il numero del preventivo ha la forma decisa in routes/preventivo.tsx: «ID» +
 *  5 caratteri, senza O/0 né I/1, perché si detta al telefono. */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function nuovoRef(): string {
  const b = new Uint32Array(5);
  crypto.getRandomValues(b);
  let s = "";
  for (let i = 0; i < 5; i++) s += ALFABETO[b[i] % ALFABETO.length];
  return `ID${s}`;
}

/** I campi che il preventivo nuovo eredita da quello vecchio, per intero.
 *  ⚠️ `id` e `created_at` NON stanno qui: il preventivo nuovo è un documento
 *   nuovo, emesso oggi, e la sua scadenza si conta da oggi. */
const DA_COPIARE =
  "nome,cognome,email,telefono,eta,grey_pct,color_code,problemi,note,base_choice,base_system,upsells,fitting_mode,timeline_start,timeline_steps,status,qty";

/** ── QUELLO CHE SERVE LEGGERE DI UNA FATTURA ──────────────────────────────
 *  Solo i campi che questa rotta tocca: il resto si ricopia com'è e non va
 *  nemmeno guardato. ⚠️ Non si importa il tipo `Fattura` per intero apposta —
 *  qui non si compone una fattura, si corregge un riferimento su una riga già
 *  scritta, e dichiarare tutti i campi darebbe l'idea sbagliata. */
interface FatturaDaCorreggere {
  preventivoRef?: string;
  stato?: string;
  dataPagamento?: string;
  causale?: string;
  numero?: number;
  anno?: number;
}

const chiaveEdit = (ref: string) => `quote_edit:${ref.toUpperCase()}`;
const chiaveSuper = (ref: string) => `quote_super:${ref.toUpperCase()}`;
const chiaveSessione = (ref: string) => `quote_session:${ref.toUpperCase()}`;

async function leggiConfig(key: string): Promise<string> {
  const { data } = await db.from("app_config").select("value").eq("key", key).maybeSingle();
  return String((data as { value?: string | null } | null)?.value ?? "");
}
/** Torna il messaggio d'errore, oppure stringa vuota se è andata bene. */
async function scriviConfig(key: string, value: string): Promise<string> {
  const { error } = await db
    .from("app_config")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  return error ? error.message : "";
}

/** Una cifra che arriva dal browser e finisce su un documento: o è un numero
 *  vero e ragionevole, o non si scrive niente. */
const cifra = (v: unknown): number | null => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return null;
  return Math.round(n * 100) / 100;
};

export const Route = createFileRoute("/api/presenter/quote-revise")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        let b: {
          ref?: string;
          code?: string;
          by?: string;
          qty?: number;
          promoDays?: number;
          extraEur?: number;
          /** `false` = le voci del preventivo nuovo nascono senza prezzo pieno:
           *  smettono di presentarsi come scontate. Il prezzo pagato non cambia. */
          upsellSconti?: boolean;
          /** `true` = le stesse scelte, ai prezzi del listino di oggi. */
          prezziOggi?: boolean;
          /** codici sconto aggiunti adesso: il valore NON si accetta, si rilegge */
          addCodes?: string[];
          totali?: { discountCode?: string | null; discountEur?: number; total?: number };
        } = {};
        try {
          b = (await request.json()) as typeof b;
        } catch {
          return json({ ok: false, reason: "corpo della richiesta illeggibile" }, 400);
        }

        const vecchio = String(b.ref || "")
          .trim()
          .toUpperCase();
        if (!vecchio) return json({ ok: false, reason: "ref mancante" }, 400);

        // ── CHI PUÒ SOSTITUIRE UN PREVENTIVO ─────────────────────────────────
        //  Le stesse tre vie di quote-edit — sessione, PIN del proprio account,
        //  codice consulente generale — e in ogni caso resta scritto CHI.
        const chi = await autorizzaPresentatore(request, b.code);
        if (!chi) return nonAutorizzato(cors);
        const autore =
          chi.via === "codice" ? String(b.by || "codice consulente").slice(0, 80) : chi.nome;
        //  Di chi è il listino con cui si riprezza: il suo, se è entrato col
        //  proprio PIN; quello di casa se ha le chiavi di casa.
        const chiSta = chi.via === "pin" ? idAmbito(chi.id) : "";

        //  Cambiare il prezzo a mano e allungare la scadenza sono lavoro da
        //  listino, e il rifiuto arriva PRIMA di scrivere qualunque cosa.
        const tocca = typeof b.extraEur === "number" || typeof b.promoDays === "number";
        if (tocca && !(await accessoPresentatore(chi)).puo("listino"))
          return vietatoP(cors, "listino");

        const total = cifra(b.totali?.total);
        const discountEur = cifra(b.totali?.discountEur);
        if (total === null || discountEur === null)
          return json({ ok: false, reason: "totale non valido" }, 400);

        // ── I CODICI SCONTO SI RILEGGONO DALLA TABELLA ───────────────────────
        //  Il browser dice QUALI codici, mai quanto valgono: senza questo giro
        //  basterebbe una richiesta costruita a mano per regalarsi una cifra.
        const codici = [...new Set((b.addCodes ?? []).map((c) => String(c).trim().toUpperCase()))]
          .filter(Boolean)
          .slice(0, 10);
        for (const c of codici) {
          const { data } = await db
            .from("discount_codes")
            .select("code, active, stock_left")
            .ilike("code", c)
            .limit(1);
          const d = (
            data as { code: string; active: boolean; stock_left: number | null }[] | null
          )?.[0];
          if (!d || d.active === false)
            return json({ ok: false, reason: "codice sconto non valido" }, 400);
          if (typeof d.stock_left === "number" && d.stock_left <= 0)
            return json({ ok: false, reason: "codice sconto esaurito" }, 400);
        }

        // ── LA RIGA VECCHIA, PER INTERO ──────────────────────────────────────
        const { data: riga, error: erroreLettura } = await db
          .from("quote_requests")
          .select(DA_COPIARE)
          .eq("quote_ref", vecchio)
          .maybeSingle();
        if (erroreLettura)
          return json(
            { ok: false, reason: `preventivo illeggibile (${erroreLettura.message})` },
            500,
          );
        if (!riga) return json({ ok: false, reason: "preventivo non trovato" }, 404);

        //  ⚠️ Se questo preventivo è GIÀ stato sostituito, qui non si sostituisce
        //   niente: si dice qual è quello buono. Modificare un documento morto
        //   creerebbe il terzo prezzo in circolazione, cioè esattamente la cosa
        //   che questa rotta esiste per impedire.
        const giaSostituito = await leggiConfig(chiaveSuper(vecchio));
        if (giaSostituito)
          return json(
            {
              ok: false,
              reason: "sostituito",
              ref: giaSostituito,
              messaggio: `Questo preventivo è già stato sostituito dal ${giaSostituito}: apri quello e rifai la modifica lì.`,
            },
            409,
          );

        const vecchia = riga as unknown as Record<string, unknown>;

        /** ── LE STESSE SCELTE, AI PREZZI DI OGGI ────────────────────────────
         *  Il preventivo porta i prezzi del giorno in cui è nato. Quando si
         *  chiede di rifarlo con il listino corrente, le voci si riprezzano QUI
         *  — non le rimanda il browser — con la stessa funzione che ha appena
         *  disegnato l'anteprima sullo schermo del consulente: due copie del
         *  conto divergerebbero, e il giorno in cui divergono il preventivo
         *  scritto in archivio non è più quello mostrato al cliente. */
        //  ⚠️ IL LISTINO DI CHI STA RIVEDENDO, non quello di casa: da quando
        //   ogni consulente ha il suo, riprezzare col listino condiviso
        //   vorrebbe dire rifare il preventivo con le cifre di un collega.
        const listinoDiOggi = async () => buildMenu(await listinoDi(chiSta));
        type Voce = { name: string; price: number; wasPrice?: number };
        let voci = (Array.isArray(vecchia.upsells) ? vecchia.upsells : []) as Voce[];
        let sistema = (vecchia.base_system ?? null) as {
          id?: string;
          name?: string;
          price?: number;
        } | null;
        if (b.prezziOggi === true) {
          const menu = await listinoDiOggi();
          voci = vociAiPrezziDiOggi(voci, menu);
          const oggi = menu.base.find((x) => x.id === sistema?.id || x.name === sistema?.name);
          //  Un sistema sparito dal listino tiene il prezzo che aveva: quello
          //  che il cliente ha scelto non si cambia da sotto.
          if (oggi && sistema) sistema = { ...sistema, price: Number(oggi.price) || 0 };
        }
        const qty =
          typeof b.qty === "number" && b.qty >= 1 && b.qty <= 9
            ? Math.round(b.qty)
            : Number(vecchia.qty) || 1;

        //  Lo stato non si eredita alla cieca: un preventivo appena emesso è
        //  «nuovo», anche se quello da cui nasce era già stato contattato. Ma
        //  una trattativa già chiusa col cliente resta chiusa — chi ha versato
        //  l'acconto non torna «da lavorare» perché si è corretto un prezzo.
        const statoVecchio = String(vecchia.status ?? "nuovo");
        const stato =
          statoVecchio === "acconto ricevuto" || statoVecchio === "confermato"
            ? statoVecchio
            : "nuovo";

        const nuova: Record<string, unknown> = {
          nome: vecchia.nome,
          cognome: vecchia.cognome,
          email: vecchia.email,
          telefono: vecchia.telefono,
          eta: vecchia.eta,
          grey_pct: vecchia.grey_pct,
          color_code: vecchia.color_code,
          problemi: vecchia.problemi,
          note: vecchia.note,
          base_choice: vecchia.base_choice,
          base_system: sistema,
          //  ── LE VOCI, CON O SENZA IL LORO PREZZO PIENO ──────────────────
          //   `wasPrice` è il listino da cui parte una personalizzazione, ed è
          //   l'unica cosa che la fa apparire scontata. Toglierlo non cambia il
          //   totale — il prezzo pagato sta in `price` — ma toglie il barrato
          //   accanto alla voce e la riga «Sconti sulle personalizzazioni» dal
          //   riepilogo delle condizioni.
          //   ⚠️ È una porta a senso unico: il preventivo nuovo nasce senza
          //    quel dato, e da lì non si può più tornare indietro. Il prezzo
          //    pieno resta però nella riga del preventivo PRECEDENTE, che non
          //    viene cancellata — se serve, è là che si va a rileggerlo.
          upsells:
            b.upsellSconti === false
              ? voci.map((u) => {
                  const { wasPrice: _via, ...resto } = (u ?? {}) as Voce;
                  return resto;
                })
              : voci,
          fitting_mode: vecchia.fitting_mode,
          timeline_start: vecchia.timeline_start,
          timeline_steps: vecchia.timeline_steps,
          qty,
          discount_code: String(b.totali?.discountCode || "").trim() || null,
          discount_eur: discountEur,
          total,
          status: stato,
        };

        // ── SI SCRIVE IL NUOVO ───────────────────────────────────────────────
        //  Otto tentativi solo per il caso raro del numero già sorteggiato.
        let nuovo = nuovoRef();
        let inserito = false;
        for (let i = 0; i < 8; i++) {
          const { error } = await db
            .from("quote_requests")
            .insert({ ...nuova, quote_ref: nuovo } as never);
          if (!error) {
            inserito = true;
            break;
          }
          if (error.code === "23505") {
            nuovo = nuovoRef();
            continue;
          }
          return json({ ok: false, reason: `preventivo non creato (${error.message})` }, 500);
        }
        if (!inserito)
          return json({ ok: false, reason: "non è stato possibile assegnare un numero" }, 500);

        // ── IL RIMANDO DAL VECCHIO AL NUOVO, PRIMA DI TUTTO IL RESTO ─────────
        //  ⚠️ Se questa scrittura non riesce, il preventivo nuovo si CANCELLA e
        //   la richiesta fallisce. Il motivo è tutto qui: senza il rimando, il
        //   link che il cliente ha già in mano resterebbe un documento valido
        //   con il prezzo vecchio, e in giro ci sarebbero due prezzi per la
        //   stessa persona. Meglio una modifica che non è riuscita — e si
        //   riprova, con il cliente ancora davanti — di due preventivi vivi.
        const erroreRimando = await scriviConfig(chiaveSuper(vecchio), nuovo);
        if (erroreRimando) {
          await db.from("quote_requests").delete().eq("quote_ref", nuovo);
          console.error(
            `[REVISE] ⚠️ rimando ${vecchio} → ${nuovo} non scritto (${erroreRimando}): il preventivo nuovo è stato annullato`,
          );
          return json(
            {
              ok: false,
              reason: `Non si è riusciti a disattivare il preventivo precedente (${erroreRimando}). Non è stato cambiato niente: riprova.`,
            },
            500,
          );
        }

        // ── DA QUI IN GIÙ NIENTE PUÒ PIÙ FAR FALLIRE LA MODIFICA ─────────────
        //  Il documento nuovo esiste e il vecchio non è più raggiungibile: sono
        //  le due cose che contano. Quello che segue è ordine — chi ha fatto il
        //  preventivo, la scheda del cliente, la scadenza scelta — e se qualcosa
        //  non riesce si DICE, invece di essere ingoiato.
        const avvisi: string[] = [];

        //  ── LA FATTURA SEGUE IL PREVENTIVO, CON LO STESSO NUMERO ──────────
        //   Richiesta del committente: modificando un preventivo, la fattura
        //   già emessa su quell'ordine si rifà — contenuto nuovo, NUMERO
        //   VECCHIO — e la vecchia sparisce.
        //
        //   ⚠️ È UNA RISCRITTURA, NON UNA FATTURA IN PIÙ, ed è il motivo per cui
        //    il numero non si tocca: emetterne una seconda lascerebbe in
        //    contabilità due documenti per la stessa operazione, e il doppione
        //    lo scopre il commercialista. Riscrivendola, la serie resta senza
        //    buchi e senza duplicati.
        //
        //   ⚠️ MA HA UN LIMITE, E VA DETTO DOVE SI LEGGE. Una fattura già
        //    TRASMESSA allo SDI non si riscrive: quella si corregge con una nota
        //    di credito, e nessun campo di questo archivio può disfarla. Qui non
        //    si sa se è stata trasmessa — lo sa il commercialista — ma si sa una
        //    cosa che le somiglia: se ci è stato registrato un incasso, quella
        //    fattura ha già avuto una vita fuori di qui. In quel caso NON si
        //    tocca e si avvisa, perché rifarla in silenzio sarebbe la peggiore
        //    delle due strade.
        {
          const rifatte: string[] = [];
          try {
            const { data: righe } = await db
              .from("app_config")
              .select("key,value")
              .like("key", "fattura:%");
            for (const r of (righe ?? []) as { key: string; value?: string }[]) {
              let f: FatturaDaCorreggere | null = null;
              try {
                f = JSON.parse(String(r.value ?? "")) as FatturaDaCorreggere;
              } catch {
                continue;
              }
              if (!f || f.stato !== "emessa") continue;
              if (String(f.preventivoRef ?? "").toUpperCase() !== vecchio.toUpperCase()) continue;

              if (f.dataPagamento) {
                avvisi.push(
                  `la fattura n. ${f.numero}/${f.anno} è già stata incassata e NON è stata rifatta: se il prezzo è cambiato serve una nota di credito`,
                );
                continue;
              }

              //  Si riscrive quello che cita l'ordine vecchio: il riferimento e
              //  la causale. ⚠️ Numero, anno, serie, data e importi restano —
              //  l'acconto non cambia perché cambia il totale del preventivo, e
              //  toccare la cifra di una fattura emessa è un'altra cosa dal
              //  correggere un riferimento.
              const causale = String(f.causale ?? "").replace(new RegExp(vecchio, "gi"), nuovo);
              const e = await scriviConfig(
                r.key,
                JSON.stringify({ ...f, preventivoRef: nuovo, causale }),
              );
              if (e) avvisi.push(`il riferimento sulla fattura n. ${f.numero}/${f.anno} (${e})`);
              else rifatte.push(`${f.numero}/${f.anno}`);
            }
          } catch (e) {
            avvisi.push(
              `le fatture collegate (${e instanceof Error ? e.message : "archivio illeggibile"})`,
            );
          }
          if (rifatte.length > 0)
            console.log(
              `[REVISE] fatture aggiornate al nuovo ordine ${nuovo}: ${rifatte.join(", ")}`,
            );
        }

        //  ── LA BOZZA SI RIFÀ DA CAPO, NON SI RITOCCA ────────────────────
        //   ⚠️ PRIMA SI AGGIORNAVANO SOLO IL RIFERIMENTO E LA CAUSALE, e
        //    l'importo restava quello del preventivo VECCHIO. Modificare un
        //    preventivo da 2.350 a 1.800 lasciava una bozza da 2.350 con dentro
        //    il numero d'ordine nuovo: coerente da guardare, sbagliata nella
        //    cifra — e quella cifra sarebbe diventata una fattura vera premendo
        //    «Emetti», senza che niente avesse mai detto che era vecchia.
        //   Adesso la vecchia si CANCELLA e se ne scrive una nuova con i numeri
        //   di adesso. È anche l'unico modo di non portarsi dietro campi rimasti
        //   da una versione precedente della bozza.
        //   ⚠️ Vale solo per le BOZZE: una fattura emessa non si ricalcola —
        //    ha un numero, e l'importo di un documento in una serie non cambia
        //    perché è cambiato un preventivo (vedi il blocco qui sopra).
        {
          try {
            const { data: righe } = await db
              .from("app_config")
              .select("key,value")
              .like("key", "fattura_bozza:%");
            //  L'aliquota è quella delle impostazioni: lo scorporo del nuovo
            //  totale si fa con la stessa regola di quando la bozza è nata.
            const azienda = await leggiAziendaSu(archivioSu(db));
            for (const r of (righe ?? []) as { key: string; value?: string }[]) {
              let f: Record<string, unknown> | null = null;
              try {
                f = JSON.parse(String(r.value ?? "")) as Record<string, unknown>;
              } catch {
                continue;
              }
              if (!f || String(f.preventivoRef ?? "").toUpperCase() !== vecchio.toUpperCase())
                continue;

              //  ⚠️ IL TOTALE NUOVO ARRIVA DAL BROWSER, come tutto il resto di
              //   questa modifica: è la cifra che il cliente ha davanti. Se non
              //   fosse leggibile si tiene quella di prima — meglio una bozza
              //   con l'importo vecchio che una a zero.
              //  ⚠️ `Number(...)` NON È MAI NULLO: su un valore illeggibile dà
              //   NaN, non null, quindi un `?? 0` in coda non lo prende mai e il
              //   NaN sarebbe arrivato fino allo scorporo — bozza con importo
              //   «NaN», che a schermo si legge «€ NaN». Il ripiego giusto è
              //   `|| 0`, che NaN lo cattura.
              const lordo = (total ?? Number(f.totale)) || 0;
              const conto = contoDaLordo(lordo, azienda.aliquotaPredefinita);
              const righeVecchie = Array.isArray(f.righe)
                ? (f.righe as { descrizione?: string; aliquota?: number }[])
                : [];
              const rifatta = {
                ...f,
                preventivoRef: nuovo,
                causale: `Conferma ordine - ${nuovo}`,
                imponibile: conto.imponibile,
                imposta: conto.imposta,
                totale: conto.totale,
                righe: [
                  {
                    descrizione: righeVecchie[0]?.descrizione ?? "Fornitura impianto capillare",
                    quantita: 1,
                    prezzoUnitario: conto.imponibile,
                    aliquota: conto.aliquota,
                  },
                ],
                creataIl: new Date().toISOString(),
              };
              //  Prima si cancella, poi si scrive: se cade la rete in mezzo
              //  resta nessuna bozza invece di una con dentro metà dei numeri
              //  vecchi e metà dei nuovi. Una bozza che manca si rifà; una con i
              //  numeri mescolati non si riconosce.
              await db.from("app_config").delete().eq("key", r.key);
              await scriviConfig(r.key, JSON.stringify(rifatta));
            }
          } catch {
            /* una bozza non rifatta non ferma niente: si corregge a mano */
          }
        }

        //  La riga vecchia si marca inattiva. Il rimando sopra la rende già
        //  irraggiungibile dal link; questo la rende riconoscibile negli elenchi,
        //  dove altrimenti resterebbe una seconda riga viva per lo stesso cliente.
        {
          const { error } = await db
            .from("quote_requests")
            .update({ status: "sostituito" } as never)
            .eq("quote_ref", vecchio);
          if (error) avvisi.push(`lo stato del preventivo precedente (${error.message})`);
        }

        //  La scadenza scelta a mano è l'unica cosa che non entra nella riga: in
        //  `quote_requests` non c'è una colonna per la validità, che si calcola
        //  dalla data di creazione. Resta quindi dov'era già, accanto al
        //  preventivo NUOVO — ma è una data, non un prezzo: la cifra che il
        //  cliente legge sta tutta nella riga, ed è questo che chiudeva il buco.
        if (typeof b.promoDays === "number" && b.promoDays > 0 && b.promoDays <= 120) {
          const d = new Date();
          d.setDate(d.getDate() + Math.round(b.promoDays));
          //  Una scadenza di sabato o domenica è una scadenza finta: il cliente
          //  non può disporre un bonifico. Si sposta al lunedì, come altrove.
          while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
          const e = await scriviConfig(
            chiaveEdit(nuovo),
            JSON.stringify({
              promoUntil: d.toISOString(),
              by: autore,
              at: new Date().toISOString(),
            }),
          );
          if (e) avvisi.push(`la nuova validità delle condizioni (${e})`);
        }

        //  Il preventivo resta di chi l'ha fatto: senza questa riga il nuovo
        //  numero risulterebbe di nessuno, e sparirebbe dai conteggi del
        //  consulente il giorno stesso in cui ha lavorato per aggiustarlo.
        {
          const raw = await leggiConfig("quote_owners");
          if (raw) {
            let m: Record<string, { id: string; nome: string }> = {};
            try {
              m = (JSON.parse(raw) as typeof m) || {};
            } catch {
              m = {};
            }
            const suo = m[vecchio];
            if (suo) {
              m[nuovo] = suo;
              const e = await scriviConfig("quote_owners", JSON.stringify(m));
              if (e) avvisi.push(`l'attribuzione al consulente (${e})`);
            }
          }
        }

        //  Il codice della consulenza in cui il preventivo è nato: serve alla
        //  pulizia quando un preventivo viene eliminato (api.presenter.quotes),
        //  per arrivare alla bozza depositata durante la costruzione.
        {
          const sess = await leggiConfig(chiaveSessione(vecchio));
          if (sess) {
            const e = await scriviConfig(chiaveSessione(nuovo), sess);
            if (e) avvisi.push(`il codice della consulenza (${e})`);
          }
        }

        //  La scheda del cliente nel CRM dice «il suo preventivo è <REF>»: se
        //  resta puntata al vecchio, chi la apre domani apre il documento morto.
        {
          const { data: schede, error } = await db
            .from("crm_leads")
            .select("id, data")
            .eq("data->>quoteRef", vecchio);
          if (error) avvisi.push(`il rimando dalla scheda cliente (${error.message})`);
          else
            for (const s of (schede ?? []) as {
              id: string;
              data: Record<string, unknown> | null;
            }[]) {
              const d = { ...(s.data ?? {}), quoteRef: nuovo };
              const { error: e } = await db.from("crm_leads").update({ data: d }).eq("id", s.id);
              if (e) avvisi.push(`il rimando dalla scheda ${s.id} (${e.message})`);
            }
        }

        console.log(
          `[REVISE] ${vecchio} → ${nuovo} da ${autore}: ${qty} impianti, totale ${total}€${avvisi.length ? ` — rimasto indietro: ${avvisi.join(" · ")}` : ""}`,
        );
        return json({
          ok: true,
          ref: nuovo,
          precedente: vecchio,
          quote: { ...nuova, quote_ref: nuovo },
          ...(avvisi.length ? { avvisi } : {}),
        });
      },
    },
  },
});
