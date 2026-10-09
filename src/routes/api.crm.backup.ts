/** COPIA COMPLETA DEL CRM E DI MEETLY ─────────────────────────────────────────
 *  Un file solo con dentro tutto ciò che è stato scritto a mano e che nessuno
 *  potrebbe ricostruire: lead, consulenti, spesa pubblicitaria, preventivi,
 *  codici sconto, disponibilità, contenuti della landing, utenti e permessi,
 *  template WhatsApp, listino, e ogni chiave di configurazione — del CRM e di
 *  Meetly — che non sia una credenziale.
 *
 *  A cosa serve: portarsi via i propri dati senza dipendere da noi, e poterli
 *  rimettere dentro. Un archivio che non si può riportare indietro non è una
 *  copia di sicurezza: è un elenco.
 *
 *  GET                       -> il file completo
 *  POST { dati, modo }       -> lo rimette dentro
 *        modo "prova"       = non scrive NULLA: dice cosa succederebbe
 *        modo "aggiungi"    = tiene quello che c'è e aggiorna il resto (predefinito)
 *        modo "sostituisci" = svuota gli archivi e riscrive: si usa per tornare indietro
 *
 *  ── TRE REGOLE CHE NON SI TOCCANO ────────────────────────────────────────
 *  1. LE CREDENZIALI NON ESCONO MAI. PIN, token, chiavi, password e sessioni
 *     restano nel database. Questo file gira per email e finisce su chiavette:
 *     un archivio con dentro i PIN dei consulenti è una fuga di dati, non un
 *     backup. L'elenco `RISERVATE` (chiavi) e `colonneRiservate` (colonne) è
 *     il punto in cui si allarga la lista, ed è l'unico.
 *  2. QUELLO CHE NON ESCE NON PUÒ ESSERE CANCELLATO DA UN'IMPORTAZIONE.
 *     `app_config` e le tabelle di configurazione non vengono MAI svuotate:
 *     dentro app_config ci sono anche le righe riservate (i PIN dei
 *     presentatori) che nel file non ci sono. Svuotare e riscrivere
 *     cancellerebbe per sempre gli accessi a Meetly senza dirlo a nessuno.
 *  3. SI LEGGE A PAGINE. PostgREST può rispondere con un tetto di righe: una
 *     `select` liscia su ottomila lead ne restituisce mille e sembra andata
 *     bene. Una copia di sicurezza che si ferma a mille righe è peggio di
 *     nessuna copia, perché uno ci conta sopra.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { guardiaCRM } from "./api.crm.accesso";

const cors = {
  "Access-Control-Allow-Origin": "*",
  //  x-crm-token: senza questa intestazione un consulente entrato col PIN non
  //  potrebbe nemmeno DICHIARARSI tale, e verrebbe letto come il titolare.
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-crm-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

// ── LA PORTA SULLE TABELLE ──────────────────────────────────────────────────
//  I tipi generati di Supabase non conoscono `app_config` (e non conoscono i
//  nomi di tabella calcolati a runtime, che è tutto il senso di questo file:
//  una sola procedura per tredici tabelle invece di tredici copie della stessa
//  procedura). Qui la porta è UNA, dichiara solo le operazioni che servono, e
//  il giorno in cui i tipi verranno rigenerati si cancella questo blocco senza
//  toccare una riga di query.
type ErroreDb = { message: string } | null;
type Riga = Record<string, unknown>;
type Elenco = PromiseLike<{ data: Riga[] | null; error: ErroreDb }>;

interface Selezione extends Elenco {
  order: (colonna: string, opzioni?: { ascending?: boolean }) => Selezione;
  range: (da: number, a: number) => Elenco;
}
interface Cancellazione extends PromiseLike<{ error: ErroreDb }> {
  not: (colonna: string, operatore: string, valore: unknown) => PromiseLike<{ error: ErroreDb }>;
  eq: (colonna: string, valore: unknown) => PromiseLike<{ error: ErroreDb }>;
}
interface Tabella {
  select: (colonne: string) => Selezione;
  insert: (righe: Riga[]) => PromiseLike<{ error: ErroreDb }>;
  update: (riga: Riga) => {
    eq: (colonna: string, valore: unknown) => { select: (colonne: string) => Elenco };
  };
  upsert: (righe: Riga[], opzioni?: { onConflict?: string }) => PromiseLike<{ error: ErroreDb }>;
  delete: () => Cancellazione;
}
const tabella = (nome: string): Tabella =>
  (supabaseAdmin as unknown as { from: (t: string) => Tabella }).from(nome);

// ── CHI PUÒ ────────────────────────────────────────────────────────────────
//  Qui dentro esce l'anagrafica completa dei clienti — nomi, telefoni, email,
//  importi — e da qui si può riscrivere l'archivio intero. Prima questa rotta
//  rispondeva a chiunque conoscesse l'indirizzo; poi a qualunque account con la
//  spunta di amministratore. Nessuna delle due domande era quella giusta:
//  la domanda è «questa PERSONA può portarsi via l'archivio?», ed è il permesso
//  `archivio` (crm/permessi.ts) a rispondere. Un consulente entrato col PIN
//  riceve 403 e nemmeno una riga di dati.
async function guardia(request: Request): Promise<Response | null> {
  const g = await guardiaCRM(request, cors, "archivio");
  return g.ok ? null : g.risposta;
}

// ── COSA C'È DENTRO ────────────────────────────────────────────────────────
//  Un elenco solo, letto sia dall'esportazione sia dall'importazione sia
//  dall'anteprima: se una tabella si aggiunge qui, compare in tutte e tre. Due
//  elenchi separati sarebbero diventati due elenchi diversi, e l'anteprima
//  avrebbe promesso righe che l'importazione non scriveva.
/*  ⚠️ L'ELENCO STA IN UN FILE SUO (crm/copia-sezioni): lo legge anche lo
    strumento che esporta tutto da riga di comando. Due elenchi scritti a
    mano in due posti sono due copie che un giorno contengono cose diverse. */
import { FUORI, SEZIONI, esportabile } from "@/crm/copia-sezioni";
// ── LETTURA A PAGINE ───────────────────────────────────────────────────────
const PAGINA = 1000;
const TETTO = 200_000;

/** Legge una tabella INTERA. L'ordinamento non è un vezzo: senza, due pagine
 *  consecutive possono restituire due volte la stessa riga e saltarne un'altra. */
async function leggiTutto(nome: string, colonne: string, ordine: string): Promise<Riga[]> {
  const fuori: Riga[] = [];
  for (let da = 0; da < TETTO; da += PAGINA) {
    const { data, error } = await tabella(nome)
      .select(colonne)
      .order(ordine, { ascending: true })
      .range(da, da + PAGINA - 1);
    if (error) throw new Error(error.message);
    const parte = data ?? [];
    fuori.push(...parte);
    if (parte.length < PAGINA) break;
  }
  return fuori;
}

/** Toglie da una riga le colonne che non devono uscire (e che non devono
 *  nemmeno rientrare: il file non è una fonte attendibile di credenziali). */
function ripulisci(r: Riga, riservate?: string[]): Riga {
  if (!riservate?.length) return r;
  const fuori: Riga = {};
  for (const [k, v] of Object.entries(r)) if (!riservate.includes(k)) fuori[k] = v;
  return fuori;
}

/** Quante registrazioni ci sono, per poterlo dire a schermo. Il valore è una
 *  stringa JSON scritta da Meetly: se è illeggibile non è un errore, è zero. */
function contaRegistrazioni(impostazioni: Riga[]): number {
  const riga = impostazioni.find((r) => r.key === "recordings");
  if (!riga) return 0;
  try {
    const v = JSON.parse(String(riga.value ?? "[]")) as unknown[];
    return Array.isArray(v) ? v.length : 0;
  } catch {
    return 0;
  }
}

interface VoceRiepilogo {
  campo: string;
  etichetta: string;
  righe: number;
  nota?: string;
  problema?: string;
}

/** ── LA COPIA, COSTRUITA UNA VOLTA SOLA ───────────────────────────────────
 *  La leggono in due: chi la scarica a mano (la GET qui sotto) e la copia
 *  automatica (api.crm.copia-automatica). Due costruzioni separate sarebbero
 *  diventate due copie diverse — e ci si accorge di quale delle due manca
 *  qualcosa solo il giorno in cui si prova a rimetterla dentro. */
export async function costruisciCopia(): Promise<Record<string, unknown>> {
  const dati: Record<string, Riga[]> = {};
  const riepilogo: VoceRiepilogo[] = [];

  //  Una tabella che manca (impianto più vecchio, migrazione non ancora
  //  applicata) non deve far fallire l'intera copia: si annota accanto
  //  alla sua voce e tutto il resto viene comunque salvato.
  for (const s of SEZIONI) {
    try {
      const righe = await leggiTutto(s.tabella, "*", s.chiave);
      dati[s.campo] = righe.map((r) => ripulisci(r, s.colonneRiservate));
      riepilogo.push({
        campo: s.campo,
        etichetta: s.etichetta,
        righe: righe.length,
        nota: s.nota,
      });
    } catch (e) {
      dati[s.campo] = [];
      riepilogo.push({
        campo: s.campo,
        etichetta: s.etichetta,
        righe: 0,
        problema: e instanceof Error ? e.message : String(e),
      });
    }
  }

  let impostazioni: Riga[] = [];
  let problemaConfig: string | undefined;
  try {
    const tutte = await leggiTutto("app_config", "key,value", "key");
    impostazioni = tutte.filter((r) => esportabile(String(r.key ?? "")));
  } catch (e) {
    problemaConfig = e instanceof Error ? e.message : String(e);
  }
  dati.impostazioni = impostazioni;

  const registrazioni = contaRegistrazioni(impostazioni);
  riepilogo.push({
    campo: "impostazioni",
    etichetta: "Impostazioni CRM e Meetly (listino, sconti quantità, template, pagine, preferenze)",
    righe: impostazioni.length,
    nota: "senza PIN, token e chiavi",
    problema: problemaConfig,
  });
  riepilogo.push({
    campo: "registrazioni",
    etichetta: "Registrazioni video: solo i riferimenti",
    righe: registrazioni,
    nota: "data, durata, nome e collegamento — i file video restano nell'archivio",
  });
  return {
    versione: 3,
    esportatoIl: new Date().toISOString(),
    ...dati,
    riepilogo,
    fuori: FUORI,
    //  Conservato per leggibilità di chi apre il file a mano.
    conteggi: Object.fromEntries(riepilogo.map((v) => [v.campo, v.righe])),
  };
}

export const Route = createFileRoute("/api/crm/backup")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const no = await guardia(request);
        if (no) return no;
        return json(await costruisciCopia());
      },

      POST: async ({ request }) => {
        const no = await guardia(request);
        if (no) return no;

        let corpo: { dati?: Record<string, Riga[]>; modo?: string } = {};
        try {
          corpo = (await request.json()) as typeof corpo;
        } catch {
          return json({ ok: false, reason: "file illeggibile" }, 400);
        }
        const d = corpo.dati;
        if (!d || typeof d !== "object") return json({ ok: false, reason: "nessun dato" }, 400);
        const prova = corpo.modo === "prova";
        const sostituisci = corpo.modo === "sostituisci";

        const righeDi = (campo: string): Riga[] => {
          const v = d[campo];
          return Array.isArray(v) ? v : [];
        };

        // ── PRIMA SI DICE COSA SUCCEDE ───────────────────────────────────
        //  Nessuna scrittura: si contano le righe del file, quante di quelle
        //  esistono già (verranno aggiornate) e quante sono nuove. Chi preme
        //  "sostituisci" deve poter leggere quante righe sta per perdere.
        if (prova) {
          const anteprima: {
            campo: string;
            etichetta: string;
            nelFile: number;
            gia: number;
            nuove: number;
            attuali: number;
            svuotabile: boolean;
            problema?: string;
          }[] = [];

          for (const s of SEZIONI) {
            const righe = righeDi(s.campo);
            try {
              const presenti = await leggiTutto(s.tabella, s.chiave, s.chiave);
              const chiavi = new Set(presenti.map((r) => String(r[s.chiave] ?? "")));
              let gia = 0;
              for (const r of righe) if (chiavi.has(String(r[s.chiave] ?? ""))) gia++;
              anteprima.push({
                campo: s.campo,
                etichetta: s.etichetta,
                nelFile: righe.length,
                gia,
                nuove: righe.length - gia,
                attuali: chiavi.size,
                svuotabile: s.svuotabile,
              });
            } catch (e) {
              anteprima.push({
                campo: s.campo,
                etichetta: s.etichetta,
                nelFile: righe.length,
                gia: 0,
                nuove: righe.length,
                attuali: 0,
                svuotabile: s.svuotabile,
                problema: e instanceof Error ? e.message : String(e),
              });
            }
          }

          const cfgFile = righeDi("impostazioni").filter((r) => esportabile(String(r.key ?? "")));
          try {
            const presenti = await leggiTutto("app_config", "key", "key");
            const chiavi = new Set(presenti.map((r) => String(r.key ?? "")));
            const gia = cfgFile.filter((r) => chiavi.has(String(r.key ?? ""))).length;
            anteprima.push({
              campo: "impostazioni",
              etichetta: "Impostazioni CRM e Meetly",
              nelFile: cfgFile.length,
              gia,
              nuove: cfgFile.length - gia,
              attuali: chiavi.size,
              svuotabile: false,
            });
          } catch (e) {
            anteprima.push({
              campo: "impostazioni",
              etichetta: "Impostazioni CRM e Meetly",
              nelFile: cfgFile.length,
              gia: 0,
              nuove: cfgFile.length,
              attuali: 0,
              svuotabile: false,
              problema: e instanceof Error ? e.message : String(e),
            });
          }

          return json({ ok: true, prova: true, anteprima });
        }

        //  Serve un proprietario per le righe del CRM: possono venire da un
        //  altro impianto, e senza titolare non sarebbero visibili a nessuno.
        const { data: primo } = await supabaseAdmin
          .from("crm_leads")
          .select("user_id")
          .limit(1)
          .maybeSingle();
        const { data: primoC } = await supabaseAdmin
          .from("crm_consultants")
          .select("user_id")
          .limit(1)
          .maybeSingle();
        const titolare =
          (primo as { user_id?: string } | null)?.user_id ||
          (primoC as { user_id?: string } | null)?.user_id ||
          (righeDi("leads")[0]?.user_id as string | undefined) ||
          (righeDi("consulenti")[0]?.user_id as string | undefined);

        const esito: Record<string, number> = {};
        const errori: { campo: string; motivo: string }[] = [];

        for (const s of SEZIONI) {
          const righe = righeDi(s.campo);
          esito[s.campo] = 0;
          if (s.forma === "crm" && !titolare) {
            if (righe.length)
              errori.push({
                campo: s.campo,
                motivo: "nessun titolare: apri il CRM almeno una volta",
              });
            continue;
          }
          if (!righe.length && !(sostituisci && s.svuotabile)) continue;

          try {
            //  Si svuota solo ciò che è dichiarato svuotabile, e solo in
            //  "sostituisci": le configurazioni si sovrascrivono, non si
            //  cancellano (vedi la regola 2 in cima al file).
            if (sostituisci && s.svuotabile) {
              const via =
                s.forma === "crm" && titolare
                  ? await tabella(s.tabella).delete().eq("user_id", titolare)
                  : await tabella(s.tabella).delete().not(s.chiave, "is", null);
              if (via.error) throw new Error(via.error.message);
            }

            if (s.colonneRiservate?.length) {
              //  Aggiorna se c'è, altrimenti inserisce. Un upsert riscriverebbe
              //  la riga INTERA e le colonne riservate — che nel file non ci
              //  sono — tornerebbero vuote: l'importazione staccherebbe le
              //  integrazioni senza dire una parola.
              for (const r of righe) {
                const pulita = ripulisci(r, s.colonneRiservate);
                const valore = pulita[s.chiave];
                if (valore == null || valore === "") continue;
                const { data: agg, error } = await tabella(s.tabella)
                  .update(pulita)
                  .eq(s.chiave, valore)
                  .select(s.chiave);
                if (error) throw new Error(error.message);
                if (!agg || agg.length === 0) {
                  const { error: e2 } = await tabella(s.tabella).insert([pulita]);
                  if (e2) throw new Error(e2.message);
                }
                esito[s.campo] += 1;
              }
              continue;
            }

            for (let i = 0; i < righe.length; i += 100) {
              const parte = righe.slice(i, i + 100).map((r) => {
                if (s.forma !== "crm") return ripulisci(r, s.colonneRiservate);
                //  L'identificativo si conserva quando c'è: è ciò che tiene in
                //  piedi il legame fra un lead e il suo consulente.
                return {
                  ...(r.id ? { id: r.id } : {}),
                  user_id: titolare,
                  data: r.data,
                };
              });
              if (!parte.length) continue;
              const { error } = await tabella(s.tabella).upsert(parte, { onConflict: s.chiave });
              if (error) throw new Error(error.message);
              esito[s.campo] += parte.length;
            }
          } catch (e) {
            //  Una sezione che fallisce non deve buttare via le altre: chi
            //  importa un archivio da un altro impianto ha spesso righe legate
            //  a utenti che qui non esistono, e il resto del file è comunque
            //  buono. L'errore si mostra, non si nasconde.
            errori.push({ campo: s.campo, motivo: e instanceof Error ? e.message : String(e) });
          }
        }

        //  `app_config` non si svuota MAI (regola 2): dentro ci sono anche le
        //  righe riservate che nel file non compaiono.
        esito.impostazioni = 0;
        for (const r of righeDi("impostazioni")) {
          const chiave = String(r.key ?? "");
          if (!chiave || !esportabile(chiave)) continue;
          const { error } = await tabella("app_config").upsert(
            [{ key: chiave, value: String(r.value ?? ""), updated_at: new Date().toISOString() }],
            { onConflict: "key" },
          );
          if (error) {
            errori.push({ campo: "impostazioni", motivo: error.message });
            break;
          }
          esito.impostazioni += 1;
        }

        return json({ ok: errori.length === 0, esito, errori });
      },
    },
  },
});
