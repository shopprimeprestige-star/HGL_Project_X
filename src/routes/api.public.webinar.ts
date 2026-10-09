/** ── WEBINAR — LA PORTA DEGLI SPETTATORI ────────────────────────────────────
 *
 *  Questa è l'unica parte del webinar aperta a chiunque abbia il link, ed è
 *  deliberatamente STRETTA: da qui si può sapere se una diretta è cominciata e
 *  agganciarsi per guardarla. Non si può andare in onda, non si può creare una
 *  stanza, non si può leggere nessuna credenziale. Trasmettere passa da
 *  `api.crm.webinar`, che vuole un utente autenticato.
 *
 *  ── LA DIFESA CONTRO CHI SI DIVERTE ───────────────────────────────────────
 *  Aprire una sessione sull'SFU costa banda, e la banda si paga. Se questo
 *  endpoint aprisse sessioni a comando, un codice trapelato diventerebbe un
 *  rubinetto sul conto Cloudflare. Quindi ci si può abbonare SOLO a una
 *  diretta viva: niente diretta, niente sessione. Quando il presentatore
 *  chiude, la porta si chiude con lui.
 *
 *  ── PERCHÉ LO STATO SI LEGGE DALLA CACHE ──────────────────────────────────
 *  Cinquecento spettatori che chiedono ogni tre secondi «è cominciato?» sono
 *  centosessanta richieste al secondo. Il Worker le regge, ma sotto c'è
 *  Supabase, e sarebbero centosessanta letture al secondo per rispondere
 *  cinquecento volte la stessa cosa. La risposta viene tenuta qualche secondo
 *  nella cache del bordo: da lì in poi Supabase vede una lettura ogni tanto,
 *  e gli spettatori la stessa risposta di prima.
 *  Il prezzo è che l'inizio della diretta si vede con qualche secondo di
 *  ritardo. Su un webinar che dura un'ora, è niente.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { leggiConfig } from "./api.crm.webinar";
import { SCADENZA_BATTITO_MS, type StanzaWebinar } from "@/webinar/tipi";
import * as sala from "@/webinar/sala.server";
import { numeroPerWhatsApp } from "@/webinar/iscrizione";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o: unknown, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": cache },
  });

const API = "https://rtc.live.cloudflare.com/v1";
/** Quanto tiene la risposta «è cominciato?». Vedi la nota in testa al file.
 *  ⚠️ ERANO TRE SECONDI, ed è sceso a UNO. Il ritardo che si vede in sala è la
 *   SOMMA di questo e di ogni quanto la sala chiede: con tre e tre e mezzo, fra
 *   il gesto di chi conduce e lo schermo di chi guarda passavano sei secondi e
 *   mezzo nel caso peggiore. La voce arriva dalla diretta e non aspetta
 *   nessuno, quindi si sentiva parlare di una cosa che a schermo compariva sei
 *   secondi dopo.
 *  ⚠️ E il conto delle letture al database non peggiora come sembra: la sala
 *   adesso chiede in fretta SOLO quando è in onda e la pagina è davvero
 *   davanti (vedi `webinar/ritmo`), e rallenta di otto volte appena finisce in
 *   secondo piano — cioè nel caso più comune di tutti, il telefono in tasca.
 *   Un secondo di cache regge comunque l'onda: mille persone che chiedono ogni
 *   secondo restano UNA lettura al secondo sotto. */
const CACHE_STATO_S = 1;

async function leggiStanza(codice: string): Promise<StanzaWebinar | null> {
  const { data } = await supabaseAdmin
    .from("app_config").select("value").eq("key", `webinar:${codice.trim().slice(0, 64)}`).maybeSingle();
  const grezzo = (data as { value?: string } | null)?.value;
  if (!grezzo) return null;
  try { return JSON.parse(grezzo) as StanzaWebinar; } catch { return null; }
}

/** ── DOVE FINISCONO I DIARI DI CHI GUARDA ────────────────────────────────
 *  In `app_config`, accanto alla stanza, e non in una tabella nuova: una
 *  tabella vuole una migrazione da applicare a mano prima che la diagnostica
 *  serva a qualcosa — e serve ADESSO, mentre il guasto c'è.
 *  ⚠️ SE NE TENGONO POCHI, E I PIÙ RECENTI. Un registro che cresce senza
 *   limite dentro una riga di configurazione prima o poi non si scrive più, e
 *   quel giorno smette di funzionare la sala e non solo la diagnostica.
 *  ⚠️ E NON SI FA MAI FALLIRE NIENTE PER COLPA SUA: se scrivere il diario non
 *   riesce, lo spettatore deve entrare lo stesso. Una diagnostica che rompe
 *   ciò che sta diagnosticando è peggio del guasto. */
const MAX_DIARI = 25;

async function aggiungiDiario(codice: string, voce: unknown): Promise<void> {
  const chiave = `webinar:diario:${codice.trim().slice(0, 64)}`;
  try {
    const { data } = await supabaseAdmin
      .from("app_config").select("value").eq("key", chiave).maybeSingle();
    let elenco: unknown[] = [];
    try { elenco = JSON.parse((data as { value?: string } | null)?.value || "[]") as unknown[]; } catch { elenco = []; }
    if (!Array.isArray(elenco)) elenco = [];
    elenco.unshift(voce);
    await supabaseAdmin.from("app_config").upsert(
      { key: chiave, value: JSON.stringify(elenco.slice(0, MAX_DIARI)) } as never,
      { onConflict: "key" },
    );
  } catch { /* la diagnostica non rompe la diretta */ }
}

/** Una diretta senza battito da troppo tempo è una scheda chiusa di colpo, non
 *  un webinar in corso: si tratta come finita, così chi arriva vede la
 *  schermata d'attesa invece di fissare un video che non arriverà mai. */
function direttaViva(s: StanzaWebinar | null): StanzaWebinar["diretta"] {
  const d = s?.diretta;
  if (!d) return null;
  const battito = Date.parse(String(d.battitoIl || "")) || 0;
  if (!battito || Date.now() - battito > SCADENZA_BATTITO_MS) return null;
  return d;
}

async function cf(appId: string, appSecret: string, percorso: string, metodo: "POST" | "PUT", corpo?: unknown) {
  const r = await fetch(`${API}/apps/${appId}${percorso}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${appSecret}`, "Content-Type": "application/json" },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  });
  const testo = await r.text();
  if (!r.ok) throw new Error(`Cloudflare ${r.status}: ${testo.slice(0, 300)}`);
  try { return JSON.parse(testo); } catch { throw new Error("Cloudflare ha risposto qualcosa che non è JSON"); }
}

interface Corpo {
  azione?: string; codice?: string; sessionId?: string; answerSdp?: string;
  /** ── IL DIARIO DI BORDO DI CHI GUARDA ──────────────────────────────────
   *  Chi lo manda: la sala, quando incontra un guasto (vedi webinar/diario).
   *  `apparecchio` è «iOS · Safari · 390px» e non l'impronta del browser. */
  apparecchio?: string;
  guasto?: string;
  /** quale gesto si sta segnando: oggi solo «whatsapp». Vedi `segnaAzione`. */
  cosa?: string;
  /** il numero di chi si iscrive, come l'ha scritto lui */
  contatto?: string;
  righe?: unknown[];
  /** identità del browser che guarda: un numero casuale nato in localStorage,
   *  non un dato personale. Serve a non contare due volte la stessa scheda e a
   *  riconoscere chi il presentatore ha fatto salire. */
  spettatore?: string; nome?: string; testo?: string;
  pass?: string; offerSdp?: string; midAudio?: string; midVideo?: string;
  parla?: boolean;
  larghezza?: number; altezza?: number;
  tracce?: { sessionId: string; trackName: string   /** sistema, browser e larghezza di chi guarda: vedi webinar/diario */
  apparecchio?: string;
  /** il codice del guasto (W01…W10) */
  guasto?: string;
  /** le righe del diario di bordo di chi guarda */
  righe?: unknown[];
}[];
}

export const Route = createFileRoute("/api/public/webinar")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      // ── È COMINCIATO? ─────────────────────────────────────────────────
      GET: async ({ request }) => {
        const codice = new URL(request.url).searchParams.get("codice") || "";
        if (!codice) return json({ error: "codice mancante" }, 400);
        const stanza = await leggiStanza(codice);
        if (!stanza) return json({ trovata: false }, 404);
        const d = direttaViva(stanza);
        //  ⚠️ QUESTA RISPOSTA STA IN CACHE, quindi può contenere SOLO cose
        //   uguali per tutti. Niente che riguardi il singolo spettatore — il
        //   suo lasciapassare per salire sul palco, per esempio — che
        //   finirebbe servito a chiunque altro dalla stessa cache. Quella roba
        //   viaggia nella risposta al battito, che è personale e non si tiene.
        const [n, chat, chiSulPalco, coda, iscrittiVeri] = await Promise.all([
          sala.conta(codice),
          sala.messaggi(codice),
          sala.palco(codice),
          sala.codaDellaMano(codice),
          //  ⚠️ In parallelo con gli altri e non dopo: questa risposta la
          //   chiedono tutti quelli in sala ogni secondo, e una lettura in fila
          //   alle altre le allungherebbe tutte.
          sala.quantiIscritti(codice),
        ]);
        return json(
          {
            trovata: true,
            titolo: stanza.titolo,
            inOnda: !!d,
            iniziataIl: d ? d.iniziataIl : null,
            //  Gli id di sessione e traccia possono stare in chiaro: da soli non
            //  permettono di trasmettere, solo di ricevere ciò che è già pubblico.
            diretta: d ? { sessionId: d.sessionId, audio: d.tracciaAudio, video: d.tracciaVideo } : null,
            //  ⚠️ Tutti quelli in onda, non solo il primo. `diretta` qui sopra
            //   resta per le schede già aperte, che leggono ancora quello.
            relatori: d?.relatori?.map((r) => ({
              id: r.id, nome: r.nome, sessionId: r.sessionId,
              audio: r.tracciaAudio, video: r.tracciaVideo, parla: !!r.parla,
              //  ⚠️ `!== false` e non `!!`: assente vuol dire ACCESA. Una sala
              //   aperta prima che questo campo esistesse direbbe altrimenti a
              //   tutti che il relatore è al buio, mentre si vede benissimo.
              camera: r.camera !== false,
            })) ?? [],
            registrando: !!d?.registrando,
            vista: d?.vista ?? "camera",
            percorso: d?.percorso ?? "",
            regia: d?.regia ?? null,
            //  ⚠️ Viaggia SEMPRE, anche a diretta finita: è proprio allora che
            //   serve, ed è il motivo per cui sta sulla stanza e non sulla
            //   diretta (vedi StanzaWebinar.whatsapp).
            whatsapp: String(stanza?.whatsapp || ""),
            //  ⚠️ Viaggia anche a diretta non ancora cominciata: è ESATTAMENTE
            //   allora che serve — è quello che fa la differenza fra una sala
            //   d'attesa muta e un conto alla rovescia.
            inizioPrevisto: String(stanza?.inizioPrevisto || ""),
            contatore: String(stanza?.contatore || "adesso"),
            contenuti: d?.contenuti ?? null,
            sala: {
              //  ⚠️ IL NUMERO CHE ESCE DI QUI È QUELLO CHE LA SALA MOSTRERÀ,
              //   scelto da chi conduce fra due numeri VERI (vedi
              //   StanzaWebinar.contatore). Non si manda «presenti» e basta
              //   lasciando decidere alla pagina: quel conto si fa in un posto
              //   solo, altrimenti il giorno che cambia cambia in metà.
              presenti:
                stanza?.contatore === "totale" ? n.passate
                : stanza?.contatore === "iscritti" ? iscrittiVeri || Math.max(0, Number(stanza?.iscritti) || 0)
                : n.presenti,
              //  ⚠️ QUANTE PERSONE CI SONO DAVVERO ADESSO, e non è un doppione
              //   di `presenti` qui sopra: quello è il numero da MOSTRARE, che
              //   chi conduce sceglie fra il totale dei passati, gli iscritti o
              //   i collegati. Questo non si mostra a nessuno — serve alla sala
              //   per decidere se la chat si può chiudere, e una decisione di
              //   disegno presa sul numero degli iscritti direbbe «sala
              //   affollata» a una stanza con dentro due persone.
              inSalaAdesso: n.presenti,
              passate: n.passate,
              //  Serve al pannello della console per riaprirsi sul valore vero.
              //  ⚠️ GLI ISCRITTI VERI VINCONO SUL NUMERO SCRITTO A MANO. Fino a
              //   ieri era solo un numero digitato nelle impostazioni: adesso
              //   che c'è una lista, quella è la verità. Il numero a mano resta
              //   come ripiego per le sale aperte prima che la lista
              //   esistesse — cancellarlo avrebbe fatto crollare a zero il
              //   contatore di quelle sale, da un giorno all'altro e senza
              //   spiegazione.
              iscritti: iscrittiVeri || Number(stanza?.iscritti) || 0,
              sogliaVisibile: Number(stanza.sogliaVisibile ?? 0),
              //  ⚠️ VIA GLI IDENTIFICATIVI. Servono alla regia per far salire
              //   chi ha scritto; qui sarebbero solo un modo per scrivere
              //   spacciandosi per un altro.
              messaggi: chat.elenco.map(({ spettatoreId: _via, ...m }) => m),
              fissato: chat.fissato ? (({ spettatoreId: _via2, ...m }) => m)(chat.fissato) : null,
              //  Il lasciapassare NON esce mai di qui: `sala.palco` non lo
              //  legge nemmeno, così non c'è modo di dimenticarselo dentro.
              palco: chiSulPalco,
              //  ⚠️ La coda esce in chiaro perché serve a CHI ASPETTA: uno che
              //   alza la mano e non sa se è il primo o il dodicesimo la
              //   riabbassa e se ne va. Sono identificativi casuali, non nomi.
              coda,
            },
          },
          200,
          `public, max-age=${CACHE_STATO_S}`,
        );
      },

      POST: async ({ request }) => {
        let b: Corpo = {};
        try { b = (await request.json()) as Corpo; } catch { /* corpo vuoto */ }
        const codice = String(b.codice || "").trim();
        if (!codice) return json({ error: "codice mancante" }, 400);

        const spettatore = String(b.spettatore || "").trim().slice(0, 64);
        const nome = String(b.nome || "").trim().slice(0, 60) || "Ospite";

        const stanza = await leggiStanza(codice);
        const diretta = direttaViva(stanza);

        // ══════════════════════════════════════════════════════════════════
        //  QUELLO CHE SI PUÒ FARE ANCHE A SALA FERMA
        //  Battito e chat funzionano prima che la diretta cominci: la gente
        //  arriva in anticipo, e una sala d'attesa in cui non si può nemmeno
        //  salutare è una sala in cui si chiude la scheda.
        // ══════════════════════════════════════════════════════════════════
        if (!stanza) return json({ error: "stanza inesistente" }, 404);

        //  ⚠️ IL BANDO SI CONTROLLA UNA VOLTA SOLA, QUI IN CIMA, e vale per
        //   tutto quello che viene dopo. Sparso in ogni azione, prima o poi se
        //   ne dimentica una — e quella diventa il buco da cui chi è stato
        //   messo alla porta continua a scrivere.
        if (spettatore && (stanza.banditi ?? []).includes(spettatore)) {
          return json({ error: "non puoi partecipare a questa diretta", bandito: true }, 403);
        }

        if (String(b.azione) === "battito") {
          if (!spettatore) return json({ error: "spettatore mancante" }, 400);
          await sala.battito(codice, spettatore, nome, { larghezza: Number(b.larghezza), altezza: Number(b.altezza) });
          //  Il lasciapassare per il palco viaggia QUI e non nello stato
          //  generale: questa risposta è di questa persona e non finisce in
          //  nessuna cache.
          const io = await sala.passDi(codice, spettatore);
          return json({ ok: true, io: io ? { stato: io.stato, pass: io.pass } : null });
        }

        if (String(b.azione) === "scrivi") {
          if (!spettatore) return json({ error: "spettatore mancante" }, 400);
          //  ⚠️ Il RUOLO non si accetta da fuori. Se lo decidesse il browser,
          //   chiunque potrebbe scrivere spacciandosi per il presentatore: si
          //   guarda invece se questa persona è davvero sul palco, e il resto
          //   è ospite. Chi conduce scrive dall'altra porta, quella autenticata.
          //  ⚠️ L'IDENTIFICATIVO DI CHI È SUL PALCO È PUBBLICO PER FORZA: sta
          //   dentro il nome delle sue tracce, che tutti devono poter chiedere
          //   per sentirlo. Quindi non basta esibirlo per parlare in suo nome:
          //   per scrivere col distintivo verde serve anche il lasciapassare,
          //   che ce l'ha solo il suo browser.
          const suPalco = await sala.passDi(codice, spettatore);
          const davveroLui = !!suPalco?.pass && suPalco.pass === String(b.pass || "");
          const ruolo = suPalco && suPalco.stato !== "attesa" && davveroLui ? "palco" : "ospite";
          const m = await sala.scrivi(codice, { spettatore, autore: nome, ruolo, testo: String(b.testo || "") });
          return json({ ok: true, messaggio: m });
        }

        if (String(b.azione) === "mano") {
          if (!spettatore) return json({ error: "spettatore mancante" }, 400);
          //  ── ⚠️ LA PORTA LA CONTROLLA IL SERVER, NON IL PULSANTE ─────────
          //   A schermo, finché chi conduce non apre, il tasto dice «non ancora
          //   il momento». Ma un tasto è un consiglio: questa porta è pubblica,
          //   e chiunque sappia il codice della sala può chiamarla a mano. Se
          //   il controllo stesse solo nella pagina, chi conduce si troverebbe
          //   la fila piena durante l'introduzione senza aver aperto niente —
          //   e non capirebbe da dove arriva.
          if (!direttaViva(stanza)?.regia?.maniAperte) {
            return json({ error: "non è ancora il momento di chiedere la parola", chiuso: true }, 409);
          }
          await sala.alzaMano(codice, spettatore, nome);
          return json({ ok: true });
        }

        if (String(b.azione) === "scendo") {
          if (!spettatore) return json({ error: "spettatore mancante" }, 400);
          //  Stessa ragione di sopra: senza il lasciapassare, chiunque
          //  conoscesse l'identificativo di chi sta parlando potrebbe farlo
          //  scendere dal palco a metà frase.
          const io = await sala.passDi(codice, spettatore);
          if (io?.pass && io.pass !== String(b.pass || "")) return json({ error: "non sei tu" }, 403);
          await sala.faiScendere(codice, spettatore);
          return json({ ok: true });
        }

        //  ── IL DIARIO DI UNO SPETTATORE ────────────────────────────────
        //   Aperto a chiunque abbia il codice della sala, come tutto il resto
        //   di questa porta: chi guarda non ha un accesso, e pretenderne uno
        //   qui vorrebbe dire che proprio i collegamenti FALLITI — gli unici
        //   che interessano — non riuscirebbero a raccontarsi.
        //  ⚠️ Non tocca l'SFU e non ha bisogno che sia configurato: sta PRIMA
        //   del controllo su `cfg.pronto`, perché «Cloudflare non è
        //   configurato» è precisamente uno dei guasti da registrare.
        //  ⚠️ W01 NON ARRIVA MAI QUI, ED È GIUSTO. Il controllo «la stanza non
        //   esiste» sta più in alto e risponde 404: un diario per una sala che
        //   non esiste non lo leggerebbe nessuno, e accettarlo vorrebbe dire
        //   lasciare che chiunque crei righe di configurazione a caso mandando
        //   codici inventati. Il codice W01 resta comunque a schermo per chi
        //   guarda, che è l'unica cosa che serve: quel guasto si risolve
        //   guardando il link, non il diario.
        //  ── ⚠️ IL GESTO CHE CONTA ─────────────────────────────────────
        //   Un `<a href>` non si può misurare: si apre WhatsApp e la pagina non
        //   sa più niente. Senza questa riga il tasto più importante della
        //   diretta è l'unico di cui non si sa se lo preme qualcuno.
        //  ⚠️ Non serve nessun lasciapassare: è un gesto pubblico e anonimo di
        //   chi è già in sala, e chiedere un permesso per contarlo vorrebbe
        //   dire non contare chi non ce l'ha — cioè quasi tutti.
        //  ── ⚠️ MI ISCRIVO ────────────────────────────────────────────
        //   Pubblica e senza permessi: e' il primo gesto che una persona fa,
        //   prima ancora di avere un nome in sala. Chiedere qualcosa in cambio
        //   qui vorrebbe dire non avere nessuna lista.
        if (String(b.azione) === "iscrivimi") {
          const contatto = numeroPerWhatsApp(String(b.contatto || ""));
          //  ⚠️ Il numero storto si dice, non si ingoia: salvare un contatto
          //   che non risponde mai vuol dire una lista che sembra piena e non
          //   porta nessuno, e non si scopre fino al giorno della diretta.
          if (!contatto) return json({ ok: false, error: "numero" }, 400);
          //  ⚠️ Se non è stato scritto davvero NON si dice «ci sei»: quella
          //   frase è una promessa fatta a una persona che ha appena lasciato
          //   il proprio numero, e mantenerla dipende da una riga che deve
          //   esistere. Meglio un «riprova» che un silenzio la sera della
          //   diretta.
          const fatto = await sala.iscrivi(codice, contatto, String(b.nome || "").trim().slice(0, 60));
          if (!fatto) return json({ ok: false, error: "non salvato" }, 503);
          return json({ ok: true, iscritti: await sala.quantiIscritti(codice) });
        }

        if (String(b.azione) === "segna") {
          const chi = String(b.spettatore || "").slice(0, 64);
          const cosa = String(b.cosa || "").slice(0, 32);
          if (chi && cosa) await sala.segnaAzione(codice, chi, cosa);
          return json({ ok: true });
        }

        if (String(b.azione) === "diario") {
          await aggiungiDiario(codice, {
            quando: new Date().toISOString(),
            apparecchio: String(b.apparecchio || "").slice(0, 120),
            codice: String(b.guasto || "").slice(0, 8),
            righe: Array.isArray(b.righe) ? b.righe.slice(0, 80) : [],
          });
          return json({ ok: true });
        }

        //  ⚠️ È QUI CHE SI CHIUDE IL RUBINETTO: fuori da una diretta viva non
        //  si apre nessuna sessione, quindi nessuno può consumare banda.
        if (!diretta) return json({ error: "la diretta non è in corso" }, 409);

        const cfg = await leggiConfig();
        if (!cfg.pronto) return json({ error: "Cloudflare non è configurato" }, 400);

        try {
          // ── MI AGGANCIO ────────────────────────────────────────────────
          if (String(b.azione) === "guarda") {
            const sess = await cf(cfg.appId, cfg.appSecret, "/sessions/new", "POST");
            const sessionId = String(sess?.sessionId || "");
            if (!sessionId) throw new Error("l'SFU non ha restituito un sessionId");

            //  Si chiedono le tracce del presentatore *per nome*. Non serve
            //  che lui sappia della nostra esistenza: è la differenza fra un
            //  SFU e la mesh, ed è il motivo per cui qui i numeri reggono.
            //  ⚠️ SI CHIEDONO LE TRACCE DI TUTTI I RELATORI. Con un webinar a
            //   due voci, agganciare solo il primo vorrebbe dire una sala che
            //   sente uno e non l'altro — e il secondo se ne accorgerebbe solo
            //   dalla chat, dopo dieci minuti di parole nel vuoto.
            //   Il ripiego sui campi vecchi serve alle sale aperte prima che
            //   l'elenco esistesse.
            const voci = diretta.relatori?.length
              ? diretta.relatori
              : [{ sessionId: diretta.sessionId, tracciaAudio: diretta.tracciaAudio, tracciaVideo: diretta.tracciaVideo }];
            const r = await cf(cfg.appId, cfg.appSecret, `/sessions/${sessionId}/tracks/new`, "POST", {
              tracks: voci.flatMap((v) => [
                { location: "remote", sessionId: v.sessionId, trackName: v.tracciaAudio },
                { location: "remote", sessionId: v.sessionId, trackName: v.tracciaVideo },
              ]),
            });
            return json({
              ok: true,
              sessionId,
              //  L'SFU risponde con un'OFFERTA (è lui che ci manda roba): il
              //  browser la applica e ci risponde, al contrario di quando si
              //  pubblica. Scambiare i due versi è l'errore classico qui.
              offerSdp: r?.sessionDescription?.sdp || "",
              serve: r?.requiresImmediateRenegotiation !== false,
              //  Stessa mappa dell'azione «aggiungi»: quale corsia porta quale
              //  traccia. Qui ce ne sono solo due (il relatore), ma tenerla
              //  uguale evita di avere due modi di leggere la stessa cosa.
              tracce: (Array.isArray(r?.tracks) ? r.tracks : []).map((t: Record<string, unknown>) => ({
                mid: String(t.mid ?? ""), trackName: String(t.trackName ?? ""),
              })),
            });
          }

          // ── SALGO SUL PALCO ────────────────────────────────────────────
          //  Uno spettatore comincia a PUBBLICARE. È l'unico punto in cui
          //  qualcuno che non è autenticato manda audio e video nella sala, e
          //  per questo pretende il lasciapassare: quel valore lo conia solo il
          //  presentatore, nel momento in cui decide di far parlare qualcuno.
          if (String(b.azione) === "salgo") {
            if (!spettatore || !b.pass) return json({ error: "non sei stato fatto salire" }, 403);
            const io = await sala.passDi(codice, spettatore);
            //  ⚠️ Confronto con `!==` e non «contiene»: qui un controllo lasco
            //   vorrebbe dire microfono aperto in una sala da centinaia di
            //   persone a chiunque sappia tirare a indovinare.
            if (!io || !io.pass || io.pass !== b.pass || io.stato === "attesa") {
              return json({ error: "non sei stato fatto salire" }, 403);
            }
            if (!b.offerSdp) return json({ error: "offerta mancante" }, 400);

            const sess = await cf(cfg.appId, cfg.appSecret, "/sessions/new", "POST");
            const mio = String(sess?.sessionId || "");
            if (!mio) throw new Error("l'SFU non ha restituito un sessionId");

            //  I nomi delle tracce portano dentro l'identificativo di chi
            //  parla: sul palco ci sono più persone insieme, e due «audio»
            //  nella stessa sala non si distinguerebbero.
            const nomeAudio = `a-${spettatore}`;
            const nomeVideo = `v-${spettatore}`;
            const tracks = [
              ...(b.midAudio ? [{ location: "local", mid: b.midAudio, trackName: nomeAudio }] : []),
              ...(io.stato === "video" && b.midVideo ? [{ location: "local", mid: b.midVideo, trackName: nomeVideo }] : []),
            ];
            const r = await cf(cfg.appId, cfg.appSecret, `/sessions/${mio}/tracks/new`, "POST", {
              sessionDescription: { type: "offer", sdp: b.offerSdp },
              tracks,
            });
            await sala.registraTracce(codice, spettatore, {
              sessionId: mio,
              audio: b.midAudio ? nomeAudio : undefined,
              video: io.stato === "video" && b.midVideo ? nomeVideo : undefined,
            });
            return json({ ok: true, sessionId: mio, answerSdp: r?.sessionDescription?.sdp || "" });
          }

          // ── STO PARLANDO ADESSO ────────────────────────────────────────
          //  Serve solo a far illuminare l'icona del microfono agli altri.
          //  Vuole comunque il lasciapassare: senza, chiunque potrebbe far
          //  lampeggiare il microfono di un altro.
          if (String(b.azione) === "parlo") {
            if (!spettatore || !b.pass) return json({ error: "non sei sul palco" }, 403);
            const io = await sala.passDi(codice, spettatore);
            if (!io || io.pass !== b.pass) return json({ error: "non sei sul palco" }, 403);
            await sala.segnalaVoce(codice, spettatore, !!b.parla);
            return json({ ok: true });
          }

          // ── SENTIRE ANCHE CHI È SALITO ─────────────────────────────────
          //  Il palco cambia durante la diretta: quando sale qualcuno, tutti
          //  devono agganciare le sue tracce SENZA rifare da capo la
          //  connessione — rifarla vorrebbe dire un buco nero di due secondi
          //  sul video del relatore ogni volta che una persona prende la parola.
          if (String(b.azione) === "aggiungi") {
            if (!b.sessionId || !Array.isArray(b.tracce) || !b.tracce.length) {
              return json({ error: "niente da aggiungere" }, 400);
            }
            const r = await cf(cfg.appId, cfg.appSecret, `/sessions/${b.sessionId}/tracks/new`, "POST", {
              tracks: b.tracce.slice(0, 32).map((t) => ({
                location: "remote", sessionId: String(t.sessionId), trackName: String(t.trackName),
              })),
            });
            return json({
              ok: true,
              offerSdp: r?.sessionDescription?.sdp || "",
              serve: r?.requiresImmediateRenegotiation === true,
              //  ⚠️ SERVE LA MAPPA mid → nome della traccia, e serve PRIMA di
              //   applicare l'offerta: sul palco ci sono più persone, e senza
              //   sapere quale «corsia» porta quale voce si finisce con quattro
              //   riquadri video e nessuna idea di chi sia chi. L'SFU la
              //   restituisce qui, e l'evento `track` porta il mid: è l'unico
              //   aggancio affidabile fra i due mondi.
              tracce: (Array.isArray(r?.tracks) ? r.tracks : []).map((t: Record<string, unknown>) => ({
                mid: String(t.mid ?? ""), trackName: String(t.trackName ?? ""),
              })),
            });
          }

          // ── ECCO LA MIA RISPOSTA ───────────────────────────────────────
          if (String(b.azione) === "rinegozia") {
            if (!b.sessionId || !b.answerSdp) return json({ error: "risposta incompleta" }, 400);
            await cf(cfg.appId, cfg.appSecret, `/sessions/${b.sessionId}/renegotiate`, "PUT", {
              sessionDescription: { type: "answer", sdp: b.answerSdp },
            });
            return json({ ok: true });
          }
        } catch (e) {
          return json({ error: String((e as Error).message || e) }, 502);
        }

        return json({ error: "azione sconosciuta" }, 400);
      },
    },
  },
});
