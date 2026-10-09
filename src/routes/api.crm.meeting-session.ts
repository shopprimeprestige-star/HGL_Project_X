/** SESSIONE DI CONSULENZA PER UN APPUNTAMENTO ───────────────────────────────
 *  Quando nel CRM si fissa un appuntamento, la consulenza deve esistere già:
 *  con il suo consulente, la sua data, e il link pronto da mandare al cliente.
 *
 *  PERCHÉ NON BASTAVA UN LINK GOOGLE MEET. Quello era un link a una stanza
 *  qualsiasi, scollegata da tutto: nessun preventivo che si compone in diretta,
 *  nessuna slide, nessuna registrazione in archivio, nessun legame con la
 *  trattativa. E arrivava solo se il consulente aveva collegato il calendario:
 *  senza, l'appuntamento restava senza link.
 *  Qui la sessione è QUELLA di Meetly, il nostro software: stesso codice in
 *  stile riunione dei link del consulente (kfr-mbqd-tzp), stessa stanza,
 *  stessi strumenti.
 *
 *  POST { leadId, consultantId?, quando?, durata?, conduco? } -> { ok, code, link }
 *       `conduco: true` = sto per condurla io adesso (vedi il POST).
 *       Ripetuto sullo stesso lead restituisce SEMPRE lo stesso codice: un
 *       appuntamento ha una stanza sola, anche se lo si salva dieci volte.
 *  POST { leadId, rigenera: true }  -> nuovo codice (appuntamento spostato a
 *       un'altra persona, oppure link da invalidare)
 *  GET  ?leadId=...                 -> { code, link, consultantId, quando }
 *
 *  Le sessioni stanno in app_config.key = 'meet:<leadId>:<consultantId>'
 *  (e 'meet:<leadId>' per la stanza storica, vedi keyOf qui sotto).
 *
 *  ── CHI PUÒ ───────────────────────────────────────────────────────────────
 *  Creare una stanza è creare un link che porta dentro una consulenza; leggere
 *  quella di un lead è sapere quando e con chi. Serve l'agenda: è il permesso
 *  di chi fissa gli appuntamenti. Vale anche la sessione di Meetly, perché la
 *  stanza si apre anche da lì.
 */
import { createFileRoute } from "@tanstack/react-router";
import { urlStanza } from "@/lib/sito";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chiamanteCRM, nonAutenticatoCRM, vietatoCRM } from "./api.crm.accesso";
import { sessioneDaRichiesta } from "./api.presenter.consultant";
//  Le chiavi e la regola «di chi è la stanza» stanno in un file a parte perché
//  si provano: vedi crm/stanza-consulenza.ts e proveDellaStanza in prove/prove.mjs.
import { chiaveStanza, chiaveStanzaStorica } from "@/crm/stanza-consulenza";
//  La chiave del rinvio sta insieme alla regola che lo fa nascere: vedi
//  crm/spostamento-meet.ts e proveDelloSpostamento in prove/prove.mjs.
import { chiaveRinvio } from "@/crm/spostamento-meet";
/*  ── PIÙ PERSONE NELLA STESSA CONSULENZA ─────────────────────────────────
    Richiesta del committente: «gli slot dove aggiungo più persone in un'unica
    consulenza, il link lo genera uguale per tutti e 3». Le regole — quando
    due appuntamenti sono la stessa consulenza, e chi è atteso — stanno in
    crm/fascia-consulenza, provate senza database. */
import {
  chiaveAttesi,
  chiaveFascia,
  leggiAttesi,
  scriviAttesi,
  unisciAttesi,
  type PersonaAttesa,
} from "@/crm/fascia-consulenza";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-crm-token, x-presenter-token",
};

/** `no` = la risposta da restituire (si è fermi qui). `cid` = il consulente
 *  che sta chiedendo, quando lo si sa dalla sua sessione.
 *
 *  ⚠️ CHI CHIEDE LO DICE LA SESSIONE, non il corpo della richiesta. Il numero
 *   del consulente mandato dal browser è quello ASSEGNATO al lead, che non è
 *   detto sia chi sta conducendo: se un collega apre una consulenza su una
 *   persona assegnata a un altro, con quel numero finirebbe nella stanza
 *   dell'altro — cioè di nuovo due padroni di casa nello stesso canale. */
async function guardia(request: Request, token?: unknown): Promise<{ no: Response | null; cid: string }> {
  //  Il presentatore è già dentro Meetly: apre la stanza per il cliente che ha
  //  davanti, e non ha un token del CRM da mandare.
  const pres = await sessioneDaRichiesta(request);
  if (pres) return { no: null, cid: "" };
  const chi = await chiamanteCRM(request, token);
  if (!chi) return { no: nonAutenticatoCRM(cors), cid: "" };
  if (!chi.accesso.puo("agenda")) return { no: vietatoCRM(cors, "agenda"), cid: "" };
  return { no: null, cid: chi.consultantId || "" };
}
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

interface Sessione {
  code: string;
  leadId: string;
  consultantId?: string;
  quando?: string;
  durata?: number;
  createdAt: string;
}

/*  ── ⚠️ UNA STANZA PER LEAD NON BASTA: SERVE LEAD + CONSULENTE ───────────
    Segnalazione del committente: «quando due consulenti diversi trasmettono
    contemporaneamente allo stesso lead, al secondo compare "il consulente sta
    trasmettendo un'altra consulenza"».

    La causa sta qui, e non nel messaggio. La stanza si chiamava col SOLO
    numero del lead: due consulenti che aprivano una consulenza per la stessa
    persona ricevevano lo STESSO codice, quindi finivano nello stesso canale —
    due padroni di casa e i clienti mescolati. Da lì il rifiuto: il cliente di
    uno bussava alla porta dell'altro, che non lo aspettava.

    Adesso la stanza porta il numero del lead E il consulente: due consulenti,
    due stanze, due link. Lo stesso consulente che riapre la stessa persona
    ritrova la SUA, come prima.

    ⚠️ LA CHIAVE STORICA RESTA. I link già mandati portano il codice che sta
     nella riga vecchia: quella continua a essere letta, e vale per il
     consulente a cui appartiene (o per chiunque, se non porta un nome).
     Si smette di sovrascriverla con la stanza di un altro, non di usarla. */
const keyOf = chiaveStanzaStorica;
const keyOfCoppia = chiaveStanza;

/** `null` = la riga non c'è. */
async function leggiChiave(chiave: string): Promise<Sessione | null> {
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", chiave).maybeSingle();
  try { return JSON.parse((data as { value?: string } | null)?.value || "null") as Sessione | null; } catch { return null; }
}

/** Stesso alfabeto dei codici del consulente: niente vocali, niente lettere che
 *  si confondono a voce (i/l/1, o/0). Un codice si detta al telefono. */
const ALFABETO = "bcdfghjkmnpqrstvwxyz";
function gruppo(n: number): string {
  let s = "";
  const r = new Uint32Array(n);
  crypto.getRandomValues(r);
  for (let i = 0; i < n; i++) s += ALFABETO[r[i] % ALFABETO.length];
  return s;
}
const nuovoCodice = () => `${gruppo(3)}-${gruppo(4)}-${gruppo(3)}`;

/*  ── ⚠️ UN APPUNTAMENTO, UNA STANZA — E IL CODICE NON CAMBIA MAI ─────────
    Segnalazione del committente: «le persone non riescono più a entrare in
    Meetly».
    Era colpa di questa funzione, com'era scritta ieri. Separando le stanze per
    consulente, un consulente che apriva una consulenza intestata a un COLLEGA
    non trovava «la sua» stanza e ne faceva coniare una nuova: la sua postazione
    passava sul codice nuovo, mentre il cliente aveva in mano il link con quello
    vecchio. Risultato: il consulente trasmetteva e il cliente restava sulla
    schermata d'attesa, su un codice dove non c'era nessuno.

    ⚠️ LA REGOLA CHE NON SI PUÒ VIOLARE: il codice di un appuntamento è
     l'unica cosa che il cliente ha in mano, ed è già partito per WhatsApp.
     Qualunque ragionamento nostro — di chi è la stanza, chi la conduce — vale
     meno di quel link. Se una stanza esiste, si riusa. Punto.

    Resta la chiave per consulente, ma solo come casa di chi una stanza NON ce
    l'ha ancora: due consulenti che aprono da zero la stessa persona hanno due
    stanze e due link, e nessuno dei due ne trova una già mandata a qualcuno.
    Per il caso «siamo in due sulla stessa persona nello stesso momento» c'è
    «Nuovo cliente» nella barra, che conia un codice nuovo apposta e lo dice. */
async function leggi(leadId: string, consultantId = ""): Promise<Sessione | null> {
  const cid = String(consultantId || "").trim();
  //  Prima di tutto la stanza dell'APPUNTAMENTO: è quella del link già mandato.
  const vecchia = await leggiChiave(keyOf(leadId));
  if (vecchia) return vecchia;
  if (cid) {
    const sua = await leggiChiave(keyOfCoppia(leadId, cid));
    if (sua) return sua;
  }
  return null;
}
async function scrivi(s: Sessione) {
  const cid = String(s.consultantId || "").trim();
  //  La stanza dell'appuntamento si scrive sempre: è quella che tutti leggono,
  //  ed è il codice che sta nel link del cliente.
  const righe = [keyOf(s.leadId)];
  //  E una copia sotto il consulente, per ritrovarla anche se un domani la
  //  riga dell'appuntamento venisse riusata da un altro.
  if (cid) righe.push(keyOfCoppia(s.leadId, cid));
  for (const key of righe) {
    await supabaseAdmin.from("app_config").upsert(
      { key, value: JSON.stringify(s), updated_at: new Date().toISOString() } as never,
      { onConflict: "key" },
    );
  }
}
/** Il link che finisce nel messaggio al cliente: porta il nome del software.
 *  I link storici (/videochiamata/CODICE) restano validi — vengono rimandati
 *  qui — ma da qui in avanti se ne generano solo con la forma nuova. */
//  Il dominio NON è più quello della richiesta: questi link finiscono nei
//  messaggi ai clienti, e un indirizzo tecnico fa esitare prima di aprirlo.
//  Sta in un punto solo (lib/sito) — l'argomento `origin` resta per non
//  cambiare le chiamate, ma non viene più usato.
const linkDi = (_origin: string, code: string) => urlStanza(code);

/** Il codice già in uso da questa fascia (stesso consulente, stessa ora), se
 *  c'è: è quello che rende il link uguale per tutte le persone dello slot. */
async function codiceDellaFascia(consultantId: string, quando: unknown): Promise<string> {
  const chiave = chiaveFascia(consultantId, quando);
  if (!chiave) return "";
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", chiave).maybeSingle();
  try {
    return String((JSON.parse((data as { value?: string } | null)?.value || "null") as { code?: string })?.code || "");
  } catch {
    return "";
  }
}

/** Segna che questa fascia si tiene in questa stanza. */
async function segnaFascia(consultantId: string, quando: unknown, code: string): Promise<void> {
  const chiave = chiaveFascia(consultantId, quando);
  if (!chiave || !code) return;
  await supabaseAdmin.from("app_config").upsert(
    { key: chiave, value: JSON.stringify({ code, il: new Date().toISOString() }), updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
}

/** ── CHI È ATTESO IN QUESTA STANZA ────────────────────────────────────────
 *  Il nome si prende dalla scheda: è quello che il cliente si troverà scritto
 *  all'ingresso, ed è quello che il consulente leggerà sul suo riquadro invece
 *  di un nome digitato al volo.
 *  ⚠️ Non fa fallire niente: se la scheda non si legge, il cliente scriverà il
 *   suo nome come ha sempre fatto. */
async function segnaAtteso(code: string, leadId: string): Promise<void> {
  if (!code || !leadId) return;
  try {
    const { data } = await supabaseAdmin.from("crm_leads").select("data").eq("id", leadId).maybeSingle();
    const d = ((data as { data?: Record<string, unknown> } | null)?.data ?? {}) as { nome?: unknown; cognome?: unknown };
    const persona: PersonaAttesa = {
      leadId,
      nome: String(d.nome ?? "").trim() || "Cliente",
      cognome: String(d.cognome ?? "").trim(),
    };
    const chiave = chiaveAttesi(code);
    const { data: riga } = await supabaseAdmin.from("app_config").select("value").eq("key", chiave).maybeSingle();
    const dopo = unisciAttesi(leggiAttesi((riga as { value?: string | null } | null)?.value), persona);
    await supabaseAdmin.from("app_config").upsert(
      { key: chiave, value: scriviAttesi(dopo), updated_at: new Date().toISOString() } as never,
      { onConflict: "key" },
    );
  } catch {
    /* l'elenco è una comodità: senza, si entra scrivendo il nome */
  }
}

export const Route = createFileRoute("/api/crm/meeting-session")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const { no, cid } = await guardia(request);
        if (no) return no;
        const u = new URL(request.url);
        const leadId = (u.searchParams.get("leadId") || "").trim();
        if (!leadId) return json({ ok: false, reason: "leadId mancante" }, 400);
        //  Senza consulente si legge la stanza storica del lead: è la domanda
        //  «che stanza ha questo lead», che continua a servire (il biglietto
        //  dell'anteprima, per esempio). Con il consulente si legge la SUA.
        const s = await leggi(leadId, cid || u.searchParams.get("consultantId") || "");
        return json(s ? { ok: true, ...s, link: linkDi(u.origin, s.code) } : { ok: true, code: null, link: null });
      },

      POST: async ({ request }) => {
        const u = new URL(request.url);
        let b: { leadId?: string; consultantId?: string; quando?: string; durata?: number; rigenera?: boolean; token?: string; conduco?: boolean } = {};
        try { b = (await request.json()) as typeof b; } catch { /* corpo facoltativo */ }
        const { no, cid } = await guardia(request, b.token);
        if (no) return no;
        /*  ── CHI È IL PADRONE DI CASA DI QUESTA STANZA ────────────────────
            Due situazioni diverse, e confonderle rompe una delle due:

             · SI FISSA un appuntamento (dalla scheda del lead, dalla coda del
               setter). La stanza è di chi FARÀ la consulenza, che è scritto
               nel corpo — un setter che fissa per un consulente non deve
               diventare il padrone di casa della sua stanza.

             · SI CONDUCE adesso (`conduco: true`, il tasto «Avvia
               consulenza»). Lì comanda la SESSIONE di chi sta chiedendo: il
               numero nel corpo è quello ASSEGNATO al lead, e un collega che
               apre una consulenza su una persona assegnata a un altro
               finirebbe nella stanza dell'altro — due padroni di casa nello
               stesso canale, che è il guasto appena tolto. */
        const conduce = b.conduco && cid ? cid : String(b.consultantId || "").trim() || cid;
        const leadId = String(b.leadId || "").trim();
        if (!leadId) return json({ ok: false, reason: "leadId mancante" }, 400);

        const esistente = await leggi(leadId, conduce);
        /*  ── ⚠️ IL CODICE VECCHIO NON DIVENTA UN VICOLO CIECO ─────────────
            Quando si conia un codice nuovo, il link di prima è già partito per
            WhatsApp: se restasse a vuoto, il cliente lo aprirebbe e si
            fermerebbe sulla schermata d'attesa di una stanza in cui non
            entrerà mai nessuno, mentre il consulente trasmette nell'altra. È
            il guasto peggiore che questo programma abbia avuto.
            Si lascia quindi un RINVIO: una riga intestata al codice vecchio
            che dice qual è quello nuovo. La legge la richiesta che l'ospite fa
            già mentre aspetta (api.presenter.session risponde con `rinvio`),
            quindi non costa né una richiesta né un millisecondo in più
            all'ingresso.
            ⚠️ Si scrive PRIMA di sovrascrivere la stanza: se la scrittura
             della stanza nuova fallisse, ci si ritroverebbe con un rinvio
             verso un codice che nessuno userà — un link che porta in una
             stanza vuota invece che in una stanza vuota, cioè lo stesso
             risultato. All'inverso — stanza nuova scritta e rinvio perduto —
             il cliente col link vecchio resterebbe fuori davvero. */
        //  Un appuntamento = una stanza. Si rigenera solo se lo si chiede
        //  esplicitamente: cambiare codice a ogni salvataggio significherebbe
        //  invalidare il link che il cliente ha già in mano.
        /*  ── ⚠️ L'ORDINE CONTA, E QUESTO È L'ORDINE ───────────────────────
            1. la stanza che questo lead HA GIÀ: il suo link è partito, vince
               su qualunque ragionamento nostro;
            2. la stanza della FASCIA: stesso consulente, stessa ora — è la
               stessa consulenza, quindi lo stesso link per tutti (richiesta
               del committente sugli slot con più persone);
            3. un codice nuovo.
            Rigenerando si salta tutto: si vuole un codice nuovo apposta. */
        const diFascia = b.rigenera ? "" : esistente ? "" : await codiceDellaFascia(conduce, b.quando);
        const code = esistente && !b.rigenera ? esistente.code : diFascia || nuovoCodice();
        if (b.rigenera && esistente?.code && esistente.code !== code) {
          await supabaseAdmin.from("app_config").upsert(
            {
              key: chiaveRinvio(esistente.code),
              value: JSON.stringify({ code, leadId, il: new Date().toISOString() }),
              updated_at: new Date().toISOString(),
            } as never,
            { onConflict: "key" },
          );
        }
        const s: Sessione = {
          code,
          leadId,
          consultantId: conduce || esistente?.consultantId,
          quando: b.quando || esistente?.quando,
          durata: Number(b.durata) || esistente?.durata || 45,
          createdAt: esistente?.createdAt || new Date().toISOString(),
        };
        await scrivi(s);
        //  La fascia si segna DOPO: se la scrittura della stanza fallisse, una
        //  fascia che punta a una stanza che non esiste manderebbe la persona
        //  dopo in una stanza vuota.
        await segnaFascia(conduce, s.quando, code);
        await segnaAtteso(code, leadId);
        return json({ ok: true, ...s, link: linkDi(u.origin, code) });
      },
    },
  },
});
