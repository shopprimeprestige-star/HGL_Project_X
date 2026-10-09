/** CHE COSA MANCA, PER UN PACCO DI LEAD IN UNA VOLTA SOLA ────────────────────
 *  POST /api/crm/anteprime-stato  { leadIds: string[] }
 *       -> { ok: true, voci: [{ leadId, stanza, invito, ha, mancanti }], sconosciuti }
 *
 *  ⚠️ `mancanti` NON è un di più decorativo, ed è il campo su cui il chiamante
 *  deve decidere: `ha` è vero appena UNO dei due codici ha un'immagine, e il
 *  caso normale è proprio quello mezzo pieno (la stanza ce l'ha, perché la
 *  deposita chi la crea; la pagina dell'invito, nata dopo, no). Chi si fermasse
 *  a `ha` lascerebbe per sempre scoperto l'altro link — e il ripiego di
 *  api.og.anteprima va in una direzione sola, da stanza scoperta si risale
 *  all'invito, non viceversa.
 *  `sconosciuti` sono i lead che questo studio non ha: deve restare vuoto, e se
 *  si riempie non è un dettaglio (vedi il filtro `chi.adminUserId` più sotto).
 *
 *  ── IL PROBLEMA CHE QUESTA ROTTA ESISTE PER RISOLVERE ─────────────────────
 *  In archivio ci sono tredici stanze Meetly e UNA sola anteprima depositata.
 *  Dodici clienti su tredici, quando ricevono il link della videoconsulenza,
 *  nel riquadro di WhatsApp vedono la scheda generica dello studio invece del
 *  biglietto col proprio nome. Non è cache e non è rete: quel biglietto non è
 *  mai stato disegnato, perché finora nasceva solo se il consulente premeva il
 *  tasto del calendario sulla riga del lead.
 *
 *  Il disegno può farlo solo il browser (vedi l'intestazione di api.anteprima:
 *  su un Worker non esiste né una tela né un carattere tipografico). Il browser
 *  però, per sapere QUALI biglietti mancano, dovrebbe fare tre domande per ogni
 *  lead — che stanza ha, che invito ha, l'anteprima c'è già — cioè trecento
 *  chiamate per un centinaio di righe. Questa rotta risponde a tutte e tre le
 *  domande per un pacco di lead in poche letture, e il browser disegna solo il
 *  mancante.
 *
 *  ── PERCHÉ BASTANO POCHE LETTURE, E NON UNA PER LEAD ──────────────────────
 *  Tutte e tre le informazioni vivono in `app_config`, indicizzate per chiave,
 *  e due chiavi su tre si costruiscono dal solo leadId:
 *
 *    che stanza ha questo lead   ->  meet:<leadId>            (api.crm.meeting-session)
 *    che invito ha questo lead   ->  invitoDi:<leadId>        (src/crm/invito)
 *    l'anteprima esiste          ->  anteprima:invito:<codice> (api.anteprima)
 *
 *  Quindi tre letture a scaglioni e non 3N. Non una sola, e va detto onestamente:
 *  la terza si costruisce con i VALORI letti dalla seconda, e la prima serve a
 *  sapere quali di questi lead sono davvero di questo studio.
 *
 *  ⚠️ NON SI CREA NIENTE. Né stanze, né inviti, né anteprime: questa rotta
 *  legge e riferisce. Creare una stanza per poterci mettere sopra un'immagine
 *  significherebbe aprire videoconsulenze che nessuno ha chiesto — e siccome
 *  `avviaConsulenza` riusa il codice che trova invece di sorteggiarne uno nuovo,
 *  la stanza fantasma di oggi diventerebbe la stanza vera di domani, con
 *  un'anteprima già in giro sotto un codice che nessuno ha deciso di consegnare
 *  a quel cliente. E soprattutto: una rotta che si chiama «che cosa manca» non
 *  può cambiare che cosa esiste, altrimenti la misura che rivelerebbe il difetto
 *  è la stessa che lo causa.
 *  Conseguenza da accettare: un lead che non ha né stanza né invito non ha
 *  nessun codice sotto cui depositare, e da qui esce con due stringhe vuote. Per
 *  quelli l'anteprima può nascere solo nel momento in cui nasce il link.
 *
 *  ⚠️ NIENTE DI PERSONALE ESCE DA QUI: né nome, né data, né consulente. Il CRM
 *  quei campi ce li ha già nella riga che sta disegnando. Escono codici, che è
 *  già il massimo che si possa concedere — un codice di stanza è una porta che
 *  si apre su una videoconsulenza, ed è il motivo per cui il filtro di studio
 *  (`chi.adminUserId`) qui sotto non è un abbellimento.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chiaveInvito, chiaveInvitoDiLead } from "@/crm/invito";
import { codicePulito as codiceInvitoPulito, formattaCodice } from "@/media/galleria";
import { chiaveAnteprima } from "./api.anteprima";
import { guardiaCRM } from "./api.crm.accesso";
import { chiaveAttesi, consulenzaDiGruppo, gettoneDi, leggiAttesi } from "@/crm/fascia-consulenza";
import { codiceAnteprimaDi } from "@/shop/chi-dal-link";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-crm-token",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** ── QUANTI LEAD PER CHIAMATA ──────────────────────────────────────────────
 *  Il tetto non lo detta il database ma il browser: ogni codice mancante è un
 *  disegno su tela 1920×1080, un ridimensionamento e un invio da ~200 KB. La
 *  scheda si pianta molto prima che Supabase se ne accorga.
 *  ⚠️ Oltre il tetto si RIFIUTA, non si tronca. Troncare in silenzio vorrebbe
 *  dire rispondere «nessun buco» per lead mai guardati, cioè ricreare — dentro
 *  la rotta scritta per curarlo — esattamente il difetto di partenza: qualcosa
 *  che sembra fatto e non c'è. */
const MASSIMO_LEAD = 60;

/** ⚠️ PostgREST riceve il filtro `in.()` nella query string: qualche centinaio
 *  di chiavi da 45 segni sfonda il tetto pratico dell'indirizzo e la richiesta
 *  torna indietro senza spiegazioni utili. Spezzata così, il numero di letture
 *  resta una manciata anche a tetto pieno — costante rispetto ai lead, non
 *  proporzionale. */
const MASSIMO_CHIAVI = 100;

function aPezzi<T>(elenco: T[], quanti = MASSIMO_CHIAVI): T[][] {
  const fuori: T[][] = [];
  for (let i = 0; i < elenco.length; i += quanti) fuori.push(elenco.slice(i, i + quanti));
  return fuori;
}

/** ⚠️ Un identificativo storto NON si aggiusta: si scarta. Ripulirlo a colpi di
 *  `replace` restituirebbe al browser un `leadId` diverso da quello che ha
 *  mandato, e quella riga non si riconoscerebbe più nella risposta. Un lead ha
 *  un uuid: tutto ciò che non ne ha la forma non è un lead, ed è anche l'igiene
 *  che tiene virgole e parentesi fuori dalla lista `in.()`. */
const idPulito = (v: unknown): string => {
  const s = String(v ?? "").trim();
  return /^[A-Za-z0-9._-]{1,64}$/.test(s) ? s : "";
};

/** ⚠️ Deve restare IDENTICA a `codicePulito` di api.anteprima: è la funzione con
 *  cui quella rotta ripulisce il codice PRIMA di comporre la chiave del
 *  deposito. Se le due divergono, qui si cercherebbe una chiave che là non è mai
 *  stata scritta — e la risposta sarebbe «manca» per un'anteprima che c'è. */
const codiceChiave = (v: unknown) =>
  String(v ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 64);

/** ⚠️ Deve restare identica a `keyOf` di api.crm.meeting-session, che non la
 *  esporta. Stessa ragione della riga qui sopra. */
const chiaveStanzaDiLead = (leadId: string) => `meet:${leadId.trim().slice(0, 64)}`;

/** app_config non compare nei tipi generati di Supabase — lo spiega
 *  src/media/config.server.ts, che per le letture a chiave singola fa già questo
 *  stesso passaggio. Qui serve una forma che quel file non ha (`in`, per leggere
 *  a scaglioni), quindi la tabella si descrive una volta sola qui sotto e il
 *  resto del file resta senza errori del compilatore. */
type RigaConfig = { key?: string | null; value?: string | null };
type LetturaConfig = PromiseLike<{ data: RigaConfig[] | null; error: unknown }>;
const configIn = (colonne: string, chiavi: string[]): LetturaConfig =>
  (
    supabaseAdmin as unknown as {
      from(t: string): {
        select(c: string): { in(colonna: string, valori: string[]): LetturaConfig };
      };
    }
  )
    .from("app_config")
    .select(colonne)
    .in("key", chiavi);

/** I valori di un elenco di chiavi. `null` = una lettura non è riuscita, ed è
 *  un esito diverso da «non c'è niente»: vedi il commento sul 500 in fondo. */
async function valoriDi(chiavi: string[]): Promise<Map<string, string> | null> {
  const mappa = new Map<string, string>();
  for (const pezzo of aPezzi([...new Set(chiavi)])) {
    const { data, error } = await configIn("key,value", pezzo);
    if (error) return null;
    for (const r of data ?? []) if (r.key) mappa.set(r.key, String(r.value ?? ""));
  }
  return mappa;
}

/** Quali di queste chiavi esistono. Si chiede la sola colonna `key`: il valore
 *  di un'anteprima è l'indirizzo del deposito, e qui non serve a nessuno. */
async function chiaviPresenti(chiavi: string[]): Promise<Set<string> | null> {
  const presenti = new Set<string>();
  for (const pezzo of aPezzi([...new Set(chiavi)])) {
    const { data, error } = await configIn("key", pezzo);
    if (error) return null;
    for (const r of data ?? []) if (r.key) presenti.add(r.key);
  }
  return presenti;
}

/** Il codice della stanza, che vive dentro il JSON della sessione. */
function codiceStanzaDa(valore: string | undefined): string {
  if (!valore) return "";
  try {
    const s = JSON.parse(valore) as { code?: unknown };
    return codiceChiave(s?.code);
  } catch {
    //  Riga illeggibile: vale come «questo lead non ha una stanza». Non si
    //  indovina un codice che apre una videoconsulenza.
    return "";
  }
}

/** ── LE FORME DEL CODICE DELL'INVITO, E PERCHÉ SONO PIÙ D'UNA ──────────────
 *  ⚠️ Il codice è salvato SENZA trattini (ACDEF3HJKMN7) mentre nell'indirizzo è
 *  raggruppato a quattro (ACDE-F3HJ-KMN7), e l'anteprima può essere stata
 *  depositata sotto l'una o l'altra forma a seconda di chi l'ha creata. È la
 *  stessa trappola già risolta in api.og.anteprima: cercarne una sola funziona
 *  a metà, che è il modo peggiore di funzionare — sembra un caso, e il perché
 *  non lo trova più nessuno. */
function formeInvito(grezzo: string): string[] {
  const pulito = codiceInvitoPulito(grezzo);
  const forme = [grezzo, grezzo.replace(/-/g, ""), pulito, pulito ? formattaCodice(pulito) : ""];
  return [...new Set(forme.map(codiceChiave).filter(Boolean))];
}

interface Voce {
  leadId: string;
  /** ── IL CODICE SOTTO CUI VA IL BIGLIETTO DI QUESTO LEAD PER LA SUA STANZA
   *  Di norma è il codice della stanza. Quando in quella stanza si aspetta più
   *  di una persona è il codice PERSONALE (`<stanza>_<gettone>`), perché il
   *  biglietto depositato sotto la sola stanza è uno solo: tre persone se lo
   *  riscrivevano sopra a turno e restava il nome del primo, mandato anche agli
   *  altri due. Vedi shop/chi-dal-link e api.og.anteprima.
   *  "" se questo lead non ha nessuna stanza. */
  stanza: string;
  /** ⚠️ Il codice COME COMPARE NELL'INDIRIZZO, cioè a gruppi di quattro
   *  (`linkInvito` ci mette `formattaCodice`). È quello sotto cui il browser
   *  deve depositare: `invito/$codice` e `meetly_/$code` scrivono nell'anteprima
   *  il parametro dell'indirizzo tale e quale, senza normalizzare niente, e
   *  un'immagine depositata sotto ACDEF3HJKMN7 non serve la pagina
   *  /invito/ACDE-F3HJ-KMN7. */
  invito: string;
  /** Esiste già un'anteprima sotto uno qualsiasi dei due codici. */
  ha: boolean;
  /** In più rispetto a `ha`, e non al posto suo: i codici di QUESTO lead che
   *  un'anteprima non ce l'hanno. Serve al caso che ha originato tutto — invito
   *  a posto e stanza scoperta — che `ha` da solo non distingue. Chi si ferma a
   *  `ha` non sbaglia niente: la stanza scoperta viene comunque servita dalla
   *  risalita stanza → lead → invito di api.og.anteprima. */
  mancanti: string[];
}

export const Route = createFileRoute("/api/crm/anteprime-stato")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        let b: { leadIds?: unknown; token?: unknown } = {};
        let illeggibile = false;
        try {
          b = (await request.json()) as typeof b;
        } catch {
          //  Si segna e si risponde DOPO la guardia: prima si dice chi sei, poi
          //  che cosa c'era di storto in quello che hai mandato.
          illeggibile = true;
        }

        //  Lo stesso permesso della scrittura (api.anteprima, ramo `invito`) e
        //  per lo stesso motivo: elencare i buchi a chi non può riempirli
        //  produrrebbe solo una lista di fallimenti. Non concede niente di
        //  nuovo — chi ha «agenda» può già creare stanze e inviti — ed è il
        //  permesso di base di chi i link li manda.
        const g = await guardiaCRM(request, cors, "agenda", { tokenInLinea: b.token });
        if (!g.ok) return g.risposta;
        if (illeggibile) return json({ ok: false, reason: "corpo_illeggibile" }, 400);
        if (!g.chi.adminUserId) return json({ ok: false, reason: "studio_non_riconosciuto" }, 400);

        const grezzi = Array.isArray(b.leadIds) ? b.leadIds : null;
        if (!grezzi?.length) return json({ ok: false, reason: "leadIds_mancante" }, 400);
        if (grezzi.length > MASSIMO_LEAD) {
          return json({ ok: false, reason: "troppi_lead", massimo: MASSIMO_LEAD }, 413);
        }
        const ids = [...new Set(grezzi.map(idPulito).filter(Boolean))];
        if (!ids.length) return json({ ok: false, reason: "leadIds_mancante" }, 400);

        // ── 1. QUALI DI QUESTI LEAD SONO DI QUESTO STUDIO ────────────────────
        //  Fa due mestieri in un gesto solo: il filtro di studio (senza, una
        //  manciata di identificativi indovinati diventerebbe un elenco di porte
        //  aperte su un'altra installazione) e la certezza che le chiavi qui
        //  sotto si costruiscano su righe vere.
        //  ⚠️ Nessun 404: un lead cancellato mentre la pagina era aperta non
        //  deve far fallire il blocco intero. Semplicemente non compare fra le
        //  `voci`, e si vede in `sconosciuti`.
        const miei: string[] = [];
        for (const pezzo of aPezzi(ids)) {
          const { data, error } = await supabaseAdmin
            .from("crm_leads")
            .select("id")
            .in("id", pezzo)
            .eq("user_id", g.chi.adminUserId);
          if (error) return json({ ok: false, reason: "lettura_fallita" }, 500);
          for (const r of data ?? []) miei.push(r.id);
        }
        const suoi = new Set(miei);
        const sconosciuti = ids.filter((i) => !suoi.has(i));
        if (!miei.length) return json({ ok: true, voci: [], sconosciuti });

        // ── 2. STANZA E INVITO DI CIASCUNO, IN UNA LETTURA A SCAGLIONI ───────
        //  ⚠️ Le chiavi si costruiscono con gli identificativi tornati dal punto
        //  1, mai con quelli arrivati nel corpo.
        const stato = await valoriDi(
          miei.flatMap((id) => [chiaveStanzaDiLead(id), chiaveInvitoDiLead(id)]),
        );
        if (!stato) return json({ ok: false, reason: "lettura_fallita" }, 500);

        interface Grezza {
          leadId: string;
          stanza: string;
          /** Il codice dell'invito come serve a comporre la chiave `invito:<…>`,
           *  prima di sapere se quella riga esiste davvero. */
          base: string;
          /** Lo stesso codice come compare nell'indirizzo: è quello che esce. */
          perIndirizzo: string;
          forme: string[];
        }
        const grezze: Grezza[] = miei.map((id) => {
          const stanza = codiceStanzaDa(stato.get(chiaveStanzaDiLead(id)));
          const scritto = String(stato.get(chiaveInvitoDiLead(id)) ?? "").trim();
          const pulito = codiceInvitoPulito(scritto);
          //  Di norma `pulito` c'è sempre (l'indice lo scrive api.crm.invito con
          //  un codice appena sorteggiato). Il ripiego sul valore scritto tale e
          //  quale è per l'archivio: una riga di forma inattesa non deve far
          //  sparire in silenzio l'invito di quel lead.
          const base = pulito || codiceChiave(scritto);
          return {
            leadId: id,
            stanza,
            base,
            perIndirizzo: pulito ? formattaCodice(pulito) : base,
            forme: base ? formeInvito(scritto || base) : [],
          };
        });

        /*  ── 2-BIS. CHI SI ASPETTA IN QUELLA STANZA ────────────────────────
            Segnalazione del committente: «ora l'anteprima mostra il nome del
            primo che ho assegnato a quell'orario, invece deve mostrare il nome
            corretto a ogni persona sul suo link».

            Il biglietto si deposita sotto un codice, e per la stanza quel
            codice era UNO per tutti: con tre persone restava il nome del primo
            passato. Quando l'elenco degli attesi dice che in quella stanza se
            ne aspetta più di una, il codice da coprire diventa quello
            personale di ciascuno.

            ⚠️ UNA LETTURA PER STANZA, NON PER LEAD: tre lead della stessa
             fascia hanno la stessa stanza e quindi la stessa chiave. È la
             ragione per cui questa rotta esiste, e non la si rompe qui.
            ⚠️ SI PERSONALIZZA SOLO CHI È DAVVERO NELL'ELENCO. Un lead che in
             quella stanza non risulta atteso non ha un gettone che qualcuno
             gli abbia mandato: gli si lascia il codice della stanza, com'era.
            ⚠️ Se la lettura non riesce NON si indovina: `null` vale come
             «nessun gruppo», cioè il comportamento di prima. Inventare un
             codice personale vorrebbe dire mandare a disegnare sotto un
             codice che nessun link porta. */
        const stanze = [...new Set(grezze.map((r) => r.stanza).filter(Boolean))];
        const attesiDi = stanze.length ? await valoriDi(stanze.map(chiaveAttesi)) : new Map();
        if (attesiDi) {
          for (const r of grezze) {
            if (!r.stanza) continue;
            const persone = leggiAttesi(attesiDi.get(chiaveAttesi(r.stanza)));
            if (!consulenzaDiGruppo(persone)) continue;
            const chi = persone.find((p) => p.leadId === r.leadId);
            if (!chi) continue;
            r.stanza = codiceChiave(codiceAnteprimaDi(r.stanza, gettoneDi(chi)));
          }
        }

        // ── 3. LE PAGINE CHE ESISTONO, E LE ANTEPRIME GIÀ DEPOSITATE ─────────
        //  Una lettura sola per due domande: sono tutte chiavi di app_config con
        //  prefissi diversi, e chiederle insieme costa quanto chiederne una.
        //  La pagina si controlla come fa già api.crm.invito: l'indice
        //  `invitoDi:` viene scritto DOPO la riga `invito:`, quindi un indice che
        //  punta al vuoto è un link morto — e su un link morto non si manda
        //  nessuno a disegnare un biglietto.
        const daChiedere: string[] = [];
        for (const r of grezze) {
          if (r.base) daChiedere.push(chiaveInvito(r.base));
          if (r.stanza) daChiedere.push(chiaveAnteprima("invito", r.stanza));
          for (const f of r.forme) daChiedere.push(chiaveAnteprima("invito", f));
        }
        const presenti = daChiedere.length ? await chiaviPresenti(daChiedere) : new Set<string>();
        if (!presenti) return json({ ok: false, reason: "lettura_fallita" }, 500);

        const voci: Voce[] = grezze.map((r) => {
          //  Pagina viva = codice da consegnare. Se la riga `invito:` non c'è,
          //  l'invito per noi non esiste: non lo si restituisce e non lo si
          //  conta, altrimenti un'anteprima depositata sotto un codice morto
          //  farebbe risultare «a posto» un lead che a posto non è.
          const invito = r.base && presenti.has(chiaveInvito(r.base)) ? r.perIndirizzo : "";
          const forme = invito ? r.forme : [];
          const stanzaHa = !!r.stanza && presenti.has(chiaveAnteprima("invito", r.stanza));
          const invitoHa = forme.some((f) => presenti.has(chiaveAnteprima("invito", f)));
          const mancanti: string[] = [];
          if (r.stanza && !stanzaHa) mancanti.push(r.stanza);
          if (invito && !invitoHa) mancanti.push(invito);
          return { leadId: r.leadId, stanza: r.stanza, invito, ha: stanzaHa || invitoHa, mancanti };
        });

        return json({ ok: true, voci, sconosciuti });
      },
    },
  },
});

/*  ── PERCHÉ IL 500 NON SI TRAVESTE DA RISPOSTA BUONA ──────────────────────
 *  ⚠️ Se una lettura non riesce non si risponde «presente» (nasconderebbe per
 *  sempre proprio i lead da sistemare) e non si risponde «mancante» (farebbe
 *  partire una tempesta di disegni e di invii). Si dice che la lettura non è
 *  riuscita, e il CRM riprova al giro dopo: è la stessa regola per cui, altrove,
 *  «non lo so» non vale mai come «va tutto bene».
 */
