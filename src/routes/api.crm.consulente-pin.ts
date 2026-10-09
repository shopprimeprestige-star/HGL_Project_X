/** PIN DEL CONSULENTE, E CON LUI I SUOI PERMESSI ─────────────────────────────
 *  Il PIN si assegna dalla schermata Consulenti del CRM e vale in due posti,
 *  perché sono lo stesso mestiere: l'accesso del consulente al CRM e il suo
 *  accesso da presentatore nelle videoconsulenze.
 *
 *  PERCHÉ QUI SI SCRIVE IN DUE TABELLE. Fino a ora esistevano due elenchi di
 *  persone che non si parlavano: i consulenti del CRM e i presentatori
 *  dell'applicazione. Stesse persone, due anagrafiche, due PIN da ricordare —
 *  e nessuna garanzia che il consulente che fissa l'appuntamento sia lo stesso
 *  che poi entra in videochiamata. Da qui in poi l'elenco è uno: si assegna il
 *  PIN al consulente, e quello stesso PIN lo fa entrare anche come presentatore.
 *
 *  ── ⚠️ QUESTA ROTTA ERA APERTA A CHIUNQUE ────────────────────────────────
 *  Non c'era nessun controllo: una sola richiesta POST da fuori assegnava un
 *  PIN a un consulente qualsiasi, e con quel PIN si entrava nel CRM e in Meetly
 *  con i dati di clienti veri. Era la porta più grande dell'applicazione, e
 *  stava spalancata. Adesso serve il permesso `consulenti`, verificato sul
 *  server (guardiaCRM): chi non ce l'ha riceve 403 e non scrive niente.
 *
 *  ── IL PERMESSO VIAGGIA COL PIN ──────────────────────────────────────────
 *  Livello e deroghe si salvano nella STESSA riga della chiave d'accesso
 *  (consultant_pins.permissions): sono la stessa decisione — "questa persona
 *  entra, e fa queste cose" — e tenerle in due posti significa assegnare il PIN
 *  oggi e i permessi mai.
 *
 *  ── ⚠️ MA IL PERMESSO ADESSO SI CALCOLA DAI MESTIERI ─────────────────────
 *  Le spunte «che lavoro fa» stanno in un'altra tabella (crm_consultants.data)
 *  e da esse dipende ciò che la persona può fare: il permesso è l'unione di
 *  quello che serve a ciascun mestiere acceso, mentre di questa riga resta
 *  decisivo ADMIN — le chiavi di casa — più le deroghe. Vedi crm/permessi.ts.
 *  Conseguenza per chi legge questo file: OGNI `risolviAccesso` qui dentro
 *  vuole anche `crm_consultants.data`, altrimenti risponde col solo livello e
 *  toglie alla persona quello che i suoi mestieri le danno. La riga si legge
 *  già per sapere di chi è il consulente, quindi non costa una query in più.
 *
 *  ── E LA REGOLA DELL'ULTIMA CHIAVE NON HA DOVUTO CAMBIARE ────────────────
 *  Nessun mestiere concede `consulenti` (è scritto e spiegato in permessi.ts):
 *  quindi «chi può assegnare PIN e permessi» dà la stessa risposta con o senza
 *  i mestieri sotto mano, e `altriConLeChiavi` continua a leggere le sole righe
 *  dei PIN. Se un giorno un mestiere aprisse quella porta, quella funzione
 *  diventerebbe bugiarda in silenzio: è il motivo per cui in permessi.ts quella
 *  regola è scritta due volte.
 *
 *  ── E NESSUNO PUÒ CHIUDERSI FUORI ────────────────────────────────────────
 *  Togliersi da soli il permesso `consulenti` — cioè scendere da ADMIN a
 *  consulente o a setter, o revocarsi l'accesso — quando non resta nessun altro
 *  che ce l'ha è un'operazione senza ritorno: nessuno potrebbe più assegnarlo.
 *  Viene rifiutata, con il motivo scritto per esteso.
 *
 *  I livelli sono ADMIN · CONSULENTE · SETTER (vedi crm/permessi.ts). Qui si
 *  accettano anche i nomi vecchi in arrivo dalla rete e si traducono: una
 *  schermata rimasta aperta da ieri non deve salvare un permesso a metà.
 *
 *  ── E QUI SI TOGLIE ANCHE LA PERSONA ─────────────────────────────────────
 *  `rimuovi:true` non è un'aggiunta di comodo: è l'unico modo perché il gesto
 *  del cestino sia DAVVERO verificato. Nel CRM la sessione Supabase del browser
 *  è sempre quella del proprietario dei dati — anche quando a lavorare è un
 *  setter entrato col PIN (vedi crm/AuthContext) — quindi le regole di riga di
 *  `crm_consultants` non sanno distinguere un setter da un admin: una
 *  cancellazione fatta dal browser passerebbe comunque. Il permesso `consulenti`
 *  esiste solo qui dentro, ed è qui dentro che deve avvenire la scrittura.
 *
 *  Il gesto è uno solo e indivisibile: conta i lead col service role (niente
 *  limiti di riga e niente copie vecchie), revoca l'accesso — CRM e presentatore
 *  — e poi SPEGNE chi ha una storia, ELIMINA solo chi non ne ha. Chi ha lead non
 *  si cancella: i suoi lead non se ne vanno con lei e finirebbero per sempre
 *  sotto «Sconosciuto», senza un nome e senza una scheda da aprire.
 *
 *  POST { consultantId, pin, nome, ruolo?, extra?, daMestieri? } -> assegna (4-8 cifre)
 *  POST { consultantId, ruolo?, extra?, daMestieri? } -> cambia solo i permessi
 *  POST { consultantId, revoca:true }                -> disattiva l'accesso
 *  POST { consultantId, rimuovi:true }               -> revoca + spegni o elimina
 *                             -> { ok, modo:"spento"|"eliminato", lead }
 *  GET  ?consultantId=...  -> { ok, attivo, ha, ruolo, concessi, extra,
 *                               dichiarato, secondoMestieri }
 *                             (il PIN non esce mai)
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { guardiaCRM } from "./api.crm.accesso";
import {
  TUTTI_I_PERMESSI,
  risolviAccesso,
  ruoloDaScritta,
  type Permesso,
  type PermessiConsulente,
} from "@/crm/permessi";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-crm-token",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

interface Presentatore {
  id: string;
  name: string;
  pin: string;
}

/** L'elenco dei presentatori dell'applicazione, dove vive il gate della barra. */
async function leggiPresentatori(): Promise<Presentatore[]> {
  const { data } = await supabaseAdmin
    .from("app_config")
    .select("value")
    .eq("key", "presenters")
    .maybeSingle();
  try {
    return JSON.parse((data as { value?: string } | null)?.value || "[]") as Presentatore[];
  } catch {
    return [];
  }
}
async function scriviPresentatori(l: Presentatore[]) {
  await supabaseAdmin.from("app_config").upsert(
    {
      key: "presenters",
      value: JSON.stringify(l),
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "key" },
  );
}

/** Il livello arriva dalla rete e si accetta solo se lo riconosciamo. Passa da
 *  `ruoloDaScritta`, che accetta ANCHE i nomi vecchi e li traduce: una scheda
 *  rimasta aperta in una linguetta da ieri manda ancora "titolare", e rifiutarlo
 *  significherebbe salvare il PIN lasciando i permessi a quello che erano —
 *  senza dirlo a nessuno. `null` = non è un livello: chi chiama non tocca quello
 *  che c'è già scritto. */
const ruoloValido = ruoloDaScritta;

/** Le deroghe arrivano dalla rete: si accettano solo le chiavi che esistono e
 *  solo i valori booleani. Copiare l'oggetto così com'è significherebbe farsi
 *  scrivere dentro la colonna dei permessi qualunque cosa. */
function extraPulito(v: unknown): Partial<Record<Permesso, boolean>> | null {
  if (!v || typeof v !== "object") return null;
  const grezzo = v as Record<string, unknown>;
  const out: Partial<Record<Permesso, boolean>> = {};
  for (const k of TUTTI_I_PERMESSI) {
    if (typeof grezzo[k] === "boolean") out[k] = grezzo[k] as boolean;
  }
  return out;
}

/** Quanti accessi ATTIVI, oltre a `escluso`, possono ancora assegnare permessi.
 *  È la domanda che impedisce l'ultima porta chiusa dall'interno. */
async function altriConLeChiavi(adminUserId: string, escluso: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("consultant_pins")
    .select("consultant_id, permissions")
    .eq("admin_user_id", adminUserId)
    .eq("active", true);
  const righe = (data ?? []) as { consultant_id: string; permissions: unknown }[];
  return righe.filter(
    (r) => r.consultant_id !== escluso && risolviAccesso(r.permissions).puo("consulenti"),
  ).length;
}

export const Route = createFileRoute("/api/crm/consulente-pin")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        //  Anche solo SAPERE chi ha le chiavi è informazione utile a chi vuole
        //  entrare: l'elenco di chi non ha ancora il PIN è la lista dei nomi su
        //  cui non serve nemmeno indovinare.
        const g = await guardiaCRM(request, cors, "consulenti");
        if (!g.ok) return g.risposta;

        const id = (new URL(request.url).searchParams.get("consultantId") || "").trim();
        if (!id) return json({ ok: false, reason: "consultantId mancante" }, 400);
        const { data } = await supabaseAdmin
          .from("consultant_pins")
          .select("id,active,permissions")
          .eq("consultant_id", id)
          .maybeSingle();
        const r = data as { active?: boolean; permissions?: unknown } | null;
        //  I mestieri stanno nell'altra tabella e sono metà della risposta: la
        //  scheda deve poter dire «può fare questo PERCHÉ fa il consulente», e
        //  senza questa riga direbbe soltanto quello che dà il livello.
        const { data: rigaC } = await supabaseAdmin
          .from("crm_consultants")
          .select("data")
          .eq("id", id)
          .maybeSingle();
        const accesso = risolviAccesso(r?.permissions, (rigaC as { data?: unknown } | null)?.data);
        return json({
          ok: true,
          ha: !!r,
          attivo: !!r?.active,
          ruolo: accesso.ruolo,
          concessi: accesso.elenco,
          //  Le deroghe tornano indietro perché la scheda le deve RIDISEGNARE
          //  come sono: dedurle dalla differenza fra elenco e base le
          //  perderebbe tutte le volte che base e deroga dicono la stessa cosa,
          //  e riaprendo la scheda un permesso tolto a mano sembrerebbe non
          //  essere mai stato tolto.
          extra: accesso.extra,
          //  Quale delle due regole vale su questa persona: serve alla scheda
          //  per dire in chiaro «i permessi seguono ancora il vecchio livello»
          //  invece di mostrare un elenco che non corrisponde alle spunte.
          secondoMestieri: accesso.secondoMestieri,
          //  Se il livello era davvero scritto nella riga o è il ripiego: la
          //  scheda lo dice a chiare lettere, perché «setter» scelto da nessuno
          //  e «setter» scelto apposta si vedono uguali, e solo il primo va
          //  guardato con sospetto.
          dichiarato: accesso.dichiarato,
        });
      },

      POST: async ({ request }) => {
        let b: {
          consultantId?: string;
          pin?: string;
          nome?: string;
          revoca?: boolean;
          /** Il cestino: revoca l'accesso e poi spegne o elimina la persona. */
          rimuovi?: boolean;
          /** Quello che il browser ha visto: `true` = ha dei lead. Si accetta
           *  SOLO come veto — può far spegnere una persona che qui risulterebbe
           *  senza storia, mai il contrario — quindi non è un permesso e non
           *  serve verificarlo. È l'ultima rete sotto una cancellazione
           *  irreversibile: il conteggio di qui confronta `data->>consulenteId`
           *  come TESTO, e un id scritto in modo appena diverso non tornerebbe. */
          haStoria?: boolean;
          ruolo?: unknown;
          extra?: unknown;
          /** Il segno del passaggio: da qui in poi i permessi di questa persona
           *  si calcolano dai MESTIERI. Lo manda la scheda del consulente, che
           *  prima di salvare mostra in chiaro che cosa cambia. Si accetta solo
           *  come booleano, e assente vuol dire «lascia com'è»: una richiesta
           *  che parla d'altro non deve spostare nessuno da una regola
           *  all'altra senza che nessuno l'abbia chiesto. */
          daMestieri?: unknown;
          /** Il token della sessione consulente, per i client che non possono
           *  aggiungere intestazioni. Letto dalla guardia, mai salvato. */
          token?: string;
        } = {};
        try {
          b = (await request.json()) as typeof b;
        } catch {
          /* corpo illeggibile = richiesta incompleta */
        }

        //  ── LA PORTA, PRIMA DI QUALUNQUE SCRITTURA ───────────────────────
        const g = await guardiaCRM(request, cors, "consulenti", { tokenInLinea: b.token });
        if (!g.ok) return g.risposta;
        const chi = g.chi;

        const id = String(b.consultantId || "").trim();
        if (!id) return json({ ok: false, reason: "consultantId mancante" }, 400);

        // il consulente deve esistere: è da lì che si prende il proprietario
        const { data: c } = await supabaseAdmin
          .from("crm_consultants")
          .select("id,user_id,data")
          .eq("id", id)
          .maybeSingle();
        //  `data` è un JSON: per spegnere la persona bisogna riscriverlo tutto
        //  con `attivo:false` dentro, senza perdere quello che non ci interessa
        //  (orari, mestieri, telefono). Da qui il tipo largo.
        const cons = c as {
          id: string;
          user_id: string;
          data: ({ nome?: string; attivo?: boolean } & Record<string, unknown>) | null;
        } | null;
        if (!cons) return json({ ok: false, reason: "consulente non trovato" }, 404);
        //  Un consulente di un altro account non si tocca, nemmeno per sbaglio:
        //  senza questa riga il permesso `consulenti` varrebbe su tutti i dati
        //  di tutte le installazioni.
        if (chi.adminUserId && cons.user_id !== chi.adminUserId) {
          return json({ ok: false, reason: "consulente di un altro account" }, 403);
        }
        const nome = String(b.nome || cons.data?.nome || "Consulente").trim();

        // ── QUELLO CHE C'È GIÀ ─────────────────────────────────────────────
        const { data: esiste } = await supabaseAdmin
          .from("consultant_pins")
          .select("id,permissions")
          .eq("consultant_id", id)
          .maybeSingle();
        const rigaEsistente = esiste as { id: string; permissions?: unknown } | null;
        //  Col mestiere sotto mano anche qui. Oggi la risposta sarebbe la
        //  stessa senza — nessun mestiere concede `consulenti` — ma scriverlo
        //  in modo diverso da tre righe più sotto è il modo in cui, il giorno in
        //  cui quella regola cambia, questa resta indietro da sola.
        const primaAveva = risolviAccesso(rigaEsistente?.permissions, cons.data).puo("consulenti");

        /** ── LA PORTA CHIUSA DALL'INTERNO ────────────────────────────────
         *  Vale solo per chi è entrato col PIN: chi ha email e password non può
         *  chiudersi fuori, la sua strada resta aperta comunque. */
        const restaSenzaChiavi = async (dopoAvra: boolean): Promise<boolean> => {
          if (chi.tipo !== "consulente") return false;
          if (!primaAveva || dopoAvra) return false;
          return (await altriConLeChiavi(cons.user_id, id)) === 0;
        };

        /** ── IL CESTINO, TUTTO DA QUESTA PARTE ───────────────────────────
         *  Sta PRIMA della revoca semplice perché la contiene: chiude le stesse
         *  due porte e poi decide che fare della scheda. Le due cose non si
         *  possono separare in due chiamate — fra l'una e l'altra ci sarebbe
         *  una persona senza accesso che continua a ricevere lead, oppure una
         *  scheda cancellata con il presentatore ancora in elenco.
         *
         *  ⚠️ L'ORDINE È QUELLO CHE È PER UNA RAGIONE. Prima si conta (una
         *  lettura: se non riesce non è successo niente), poi si revoca, poi si
         *  scrive. Contare dopo aver revocato vorrebbe dire lasciare mezzo
         *  gesto compiuto ogni volta che il conto non arriva. */
        if (b.rimuovi) {
          //  La stessa regola dei permessi, sullo stesso metro: togliere di
          //  mezzo l'ultima persona che può assegnare PIN e permessi chiude il
          //  CRM dall'interno, e nessuno potrebbe più riaprirlo.
          if (await restaSenzaChiavi(false)) {
            return json(
              {
                ok: false,
                reason:
                  "Non puoi togliere questa persona: è l'ultimo accesso che può assegnare PIN e permessi, e dopo nessuno potrebbe più riaprire il CRM. Dai prima il livello ADMIN a un'altra persona, dalla sua scheda.",
              },
              409,
            );
          }

          //  ── QUANTI LEAD HA DAVVERO ────────────────────────────────────
          //   Col service role, e qui: è l'unico conteggio di cui ci si può
          //   fidare per una scelta irreversibile. Quello del browser vede
          //   solo i lead che quella pagina si è caricata, e la pagina può
          //   essere aperta da un'ora.
          const { count, error: erroreConta } = await supabaseAdmin
            .from("crm_leads")
            .select("id", { count: "exact", head: true })
            .eq("user_id", cons.user_id)
            .eq("data->>consulenteId", id);
          if (erroreConta || typeof count !== "number") {
            return json(
              {
                ok: false,
                reason: `Non sono riuscito a contare i suoi lead${erroreConta?.message ? ` (${erroreConta.message})` : ""}, e senza quel numero non tocco niente: cancellare per sbaglio chi ha una storia non si può annullare. Riprova fra un momento.`,
              },
              502,
            );
          }

          // ── LE CHIAVI, IN OGNI CASO: CRM E VIDEOCONSULENZA ─────────────
          const { error: erroreRevoca } = await supabaseAdmin
            .from("consultant_pins")
            .update({ active: false } as never)
            .eq("consultant_id", id);
          if (erroreRevoca) {
            return json(
              {
                ok: false,
                reason: `Accesso non revocato (${erroreRevoca.message}): non ho tolto nessuno. La persona è ancora al suo posto.`,
              },
              500,
            );
          }
          await scriviPresentatori((await leggiPresentatori()).filter((p) => p.id !== id));

          // ── SPEGNI CHI HA UNA STORIA ───────────────────────────────────
          //  Basta che UNO dei due l'abbia vista, quella storia: fra i due
          //  errori possibili, spegnere chi non aveva niente si annulla con un
          //  interruttore, cancellare chi aveva dei lead no.
          if (count > 0 || b.haStoria === true) {
            const dati = { ...(cons.data ?? {}), attivo: false };
            const { data: righe, error } = await supabaseAdmin
              .from("crm_consultants")
              .update({ data: dati } as never)
              .eq("id", id)
              .select("id");
            //  Zero righe senza errore è il «successo» che non è successo, ed è
            //  il modo in cui questa applicazione ha già mentito tre volte.
            if (error || !righe?.length) {
              return json(
                {
                  ok: false,
                  reason: `Accesso revocato, ma non sono riuscito a spegnerla${error?.message ? `: ${error.message}` : ": il database non ha modificato nessuna riga"}. Continua a risultare attiva e a ricevere lead: ricarica e riprova.`,
                },
                500,
              );
            }
            console.log(
              `[PIN] ${cons.data?.nome ?? id} spenta da ${chi.nome} (${count} lead contati)`,
            );
            return json({ ok: true, modo: "spento", lead: count });
          }

          // ── ELIMINA SOLO CHI NON HA NIENTE DA RENDERE ANONIMO ──────────
          const { data: righe, error } = await supabaseAdmin
            .from("crm_consultants")
            .delete()
            .eq("id", id)
            .select("id");
          if (error || !righe?.length) {
            return json(
              {
                ok: false,
                reason: `Accesso revocato, ma la scheda non è stata cancellata${error?.message ? `: ${error.message}` : ": il database non ha cancellato nessuna riga"}. Ricarica e riprova.`,
              },
              500,
            );
          }
          console.log(`[PIN] ${cons.data?.nome ?? id} eliminata da ${chi.nome} (nessun lead)`);
          return json({ ok: true, modo: "eliminato", lead: 0 });
        }

        if (b.revoca) {
          if (await restaSenzaChiavi(false)) {
            return json(
              {
                ok: false,
                reason:
                  "Non puoi revocare questo accesso: è l'ultimo che può assegnare PIN e permessi. Dai prima il livello ADMIN a un'altra persona, dalla sua scheda.",
              },
              409,
            );
          }
          await supabaseAdmin
            .from("consultant_pins")
            .update({ active: false } as never)
            .eq("consultant_id", id);
          //  Il presentatore corrispondente sparisce dall'elenco: revocare
          //  l'accesso deve chiudere ENTRAMBE le porte, non una sola.
          await scriviPresentatori((await leggiPresentatori()).filter((p) => p.id !== id));
          return json({ ok: true, attivo: false });
        }

        // ── I PERMESSI ─────────────────────────────────────────────────────
        //  Si parte da quelli che ci sono già e si sovrascrive solo ciò che è
        //  stato mandato: una richiesta che cambia il PIN e non parla di
        //  permessi non deve azzerarli, e viceversa.
        const precedenti = (rigaEsistente?.permissions ?? {}) as PermessiConsulente;
        const ruolo = ruoloValido(b.ruolo);
        const extra = extraPulito(b.extra);
        //  Solo un booleano, e solo se c'è: qualunque altra cosa arrivi dalla
        //  rete non sposta questa persona da una regola all'altra.
        const daMestieri = typeof b.daMestieri === "boolean" ? b.daMestieri : null;
        const permessi: PermessiConsulente = {
          ...(typeof precedenti === "object" && precedenti ? precedenti : {}),
          ...(ruolo ? { ruolo } : {}),
          ...(extra ? { extra } : {}),
          ...(daMestieri === null ? {} : { daMestieri }),
        };
        //  I tre campi inglesi storici seguono la decisione nuova, altrimenti
        //  resterebbero a comandare loro: `risolviAccesso` li legge PRIMA delle
        //  deroghe, e una riga vecchia con canDeleteLead:false continuerebbe a
        //  vietare la cancellazione anche a un admin appena nominato.
        //  ⚠️ Si scrivono col MESTIERE sotto mano, o direbbero di no proprio a
        //  chi fa il consulente. E su una riga passata ai mestieri non
        //  comandano più (permessi.ts smette di leggerle): restano aggiornate
        //  qui per chi le legge ancora com'erano, non per decidere.
        if (ruolo || extra || daMestieri !== null) {
          const risolto = risolviAccesso(permessi, cons.data);
          permessi.canDeleteLead = risolto.puo("lead.elimina");
          permessi.canAddLead = risolto.puo("lead.crea");
          permessi.canChangePayment = risolto.puo("pagamenti");
        }
        const dopoAvra = risolviAccesso(permessi, cons.data).puo("consulenti");

        if (await restaSenzaChiavi(dopoAvra)) {
          return json(
            {
              ok: false,
              reason:
                "Non puoi toglierti il permesso «Gestire consulenti, PIN e permessi»: sei l'ultimo che ce l'ha, e dopo nessuno potrebbe più assegnarlo — nemmeno a te. Dai prima il livello ADMIN a un'altra persona, poi torna qui.",
            },
            409,
          );
        }

        // ── SOLO PERMESSI, SENZA TOCCARE IL PIN ────────────────────────────
        const pin = String(b.pin || "").trim();
        if (!pin) {
          if (!rigaEsistente) {
            return json({ ok: false, reason: "assegna prima un PIN a questo consulente" }, 400);
          }
          await supabaseAdmin
            .from("consultant_pins")
            .update({ permissions: permessi } as never)
            .eq("consultant_id", id);
          return json({ ok: true, attivo: true, ruolo: risolviAccesso(permessi, cons.data).ruolo });
        }

        //  Quattro-otto cifre: si digita davanti al cliente, su un telefono, e
        //  deve poter essere dettato al volo. Niente lettere.
        if (!/^\d{4,8}$/.test(pin))
          return json({ ok: false, reason: "il PIN deve avere da 4 a 8 cifre" }, 400);

        //  ── ⚠️ L'ESITO DELLA SCRITTURA SI LEGGE ──────────────────────────
        //  Qui non si guardava, e il difetto che ne veniva era il peggiore
        //  possibile: il database rifiutava, la rotta rispondeva «fatto», la
        //  scheda diceva PIN assegnato — e riaprendola il PIN non c'era. Da
        //  fuori sembrava che il salvataggio «a volte non prendesse».
        //
        //  ⚠️ E il rifiuto è quasi sempre lo stesso: `pin text not null UNIQUE`
        //  (migrazione 20260419145616). Il PIN è unico su TUTTO l'archivio, non
        //  per persona: dare a un setter lo stesso codice che ha già un
        //  consulente è la cosa più naturale del mondo — sono numeri corti e
        //  memorabili — e finiva in silenzio. Adesso lo si dice in italiano,
        //  con il rimedio dentro la frase.
        const esito = rigaEsistente
          ? await supabaseAdmin
              .from("consultant_pins")
              .update({ pin, active: true, permissions: permessi } as never)
              .eq("consultant_id", id)
              .select("id")
          : await supabaseAdmin
              .from("consultant_pins")
              .insert({
                consultant_id: id,
                admin_user_id: cons.user_id,
                pin,
                active: true,
                permissions: permessi,
              } as never)
              .select("id");

        if (esito.error) {
          const codice = String((esito.error as { code?: string }).code || "");
          const messaggio =
            codice === "23505"
              ? "Questo PIN è già in uso da un'altra persona: scegline un altro."
              : esito.error.message || "il database ha rifiutato la scrittura";
          console.error(`[PIN] scrittura rifiutata per ${nome}: ${codice} ${esito.error.message}`);
          return json({ ok: false, reason: messaggio }, 409);
        }
        //  Una scrittura respinta dalle regole di riga torna SENZA errore e con
        //  zero righe toccate: senza questo controllo il caso più silenzioso di
        //  tutti passerebbe per riuscito.
        if (!Array.isArray(esito.data) || esito.data.length === 0) {
          console.error(`[PIN] nessuna riga scritta per ${nome}`);
          return json(
            { ok: false, reason: "il PIN non è stato salvato: riprova, e se insiste rientra." },
            500,
          );
        }

        //  ── LO STESSO PIN VALE COME PRESENTATORE ─────────────────────────
        //  Stessa persona, stesso codice: chi fissa l'appuntamento nel CRM è
        //  chi entra in videoconsulenza, e il cliente vede il suo nome.
        const lista = await leggiPresentatori();
        const i = lista.findIndex((p) => p.id === id);
        if (i >= 0) lista[i] = { id, name: nome, pin };
        else lista.push({ id, name: nome, pin });
        await scriviPresentatori(lista);

        console.log(`[PIN] accesso aggiornato per ${nome} da ${chi.nome}`);
        return json({ ok: true, attivo: true, ruolo: risolviAccesso(permessi, cons.data).ruolo });
      },
    },
  },
});
