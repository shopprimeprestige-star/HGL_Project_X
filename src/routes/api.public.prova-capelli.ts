/** ── LA PORTA DELLA PROVA CAPELLI ──────────────────────────────────────────
 *
 *  POST { foto, taglio, colore?, calvo? } → { immagine } — una foto con il
 *  taglio addosso. GET ?azione=stato → dice se c'è una chiave e quale modello
 *  si userebbe, PRIMA che qualcuno carichi una foto per niente.
 *
 *  ── ⚠️ LA FOTO NON SI SALVA DA NESSUNA PARTE ─────────────────────────────
 *  Entra nella richiesta, va al modello, torna indietro e muore lì. Niente
 *  deposito, niente tabella, niente registro: è la faccia di una persona, e
 *  l'unico modo di non perderla è non averla. Per lo stesso motivo qui dentro
 *  non si scrive mai la foto nei log — nemmeno un pezzo.
 *
 *  ── ⚠️ IL MODELLO NON È INCHIODATO ───────────────────────────────────────
 *  Si legge l'elenco vero dei modelli con USCITA immagine e si sceglie il
 *  primo che si preferisce fra quelli disponibili. Scrivere uno slug fisso
 *  vuol dire rompersi il giorno in cui viene ritirato — ed è già successo, su
 *  un altro sito, con «gemini-2.5-flash-image-preview» sparito da un giorno
 *  all'altro. Meglio una lista di preferenze e un ripiego.
 *
 *  ── ⚠️ E C'È UN TETTO ────────────────────────────────────────────────────
 *  Ogni immagine costa. Questa pagina sta su un indirizzo che si può mandare a
 *  chiunque, quindi un tetto ci vuole: è per visitatore e per giornata, e sta
 *  nella memoria del servitore. Non è una cassaforte — un servitore che
 *  riparte azzera il conto — ma toglie di mezzo il caso che fa danno davvero,
 *  cioè la stessa persona che preme cento volte.
 */
import { createFileRoute } from "@tanstack/react-router";
import { type Composto, compostoPieno } from "@/prova/composto";
import { trovaLaterale } from "@/prova/laterali";
import { COLORE_DA_FOTO, costruisciPrompt, fotoAccettabile } from "@/prova/tagli";
import { notaPulita } from "@/prova/ritocchi";
import { campioni } from "@/prova/campioni.server";
import { catalogoIntero, tagliaOvunque } from "@/prova/catalogo.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { anteprimeDi, consumaProva, eliminaAnteprime, salvaAnteprima, trovaAnteprima, trovaCodice } from "@/prova/archivio.server";
import { salvaImmagine } from "@/prova/catalogo.server";
import { attaccaAlLead } from "@/prova/anteprime-lead.server";
import { formaValida, leggibile, normalizza, PROVE_COMPRESE, puoProvare } from "@/prova/codici";
import { leggiConfigAI } from "./api.crm.ai";
import { conta, VUOTO, type Conteggi } from "@/prova/classifica";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** Quante prove al giorno per visitatore. Otto: bastano a provare tre tagli e
 *  due colori, che è quello che fa una persona interessata davvero. */
const TETTO_AL_GIORNO = 8;

/** Quanto si segna quando il modello non dichiara il costo: dieci centesimi,
 *  che è quello che è costata ogni immagine finora. Dichiarato qui perché il
 *  giorno che cambia si cambia in un posto solo. */
const COSTO_STIMATO = 10;
const conti = new Map<string, { giorno: string; quante: number }>();

function passaIlTetto(chi: string): { ok: boolean; restano: number } {
  const giorno = new Date().toISOString().slice(0, 10);
  const c = conti.get(chi);
  const attuale = c && c.giorno === giorno ? c.quante : 0;
  if (attuale >= TETTO_AL_GIORNO) return { ok: false, restano: 0 };
  conti.set(chi, { giorno, quante: attuale + 1 });
  return { ok: true, restano: TETTO_AL_GIORNO - attuale - 1 };
}

/** In ordine di preferenza. Non è un elenco di slug obbligatori: è l'ordine con
 *  cui si guarda quello che c'è davvero. */
const PREFERITI = [
  "google/gemini-3.1-flash-image",
  "google/gemini-2.5-flash-image",
  "google/gemini-3-pro-image",
  "openai/gpt-5-image",
];

let scelto: { id: string; quando: number } | null = null;

async function modelloBuono(imposto: string): Promise<{ modello?: string; errore?: string }> {
  //  ⚠️ Un modello scelto a mano dalle impostazioni VINCE, e non si controlla
  //   che esista: chi lo imposta lo sta facendo apposta, magari per provare
  //   qualcosa uscito ieri che il nostro elenco di preferenze non conosce.
  //   Se è sbagliato lo dice OpenRouter, con parole sue, alla prima prova.
  if (imposto) return { modello: imposto };
  //  Dieci minuti di memoria: l'elenco dei modelli cambia una volta al mese, e
  //  chiederlo a ogni prova aggiunge mezzo secondo a ogni foto.
  if (scelto && Date.now() - scelto.quando < 10 * 60 * 1000) return { modello: scelto.id };
  try {
    const r = await fetch("https://openrouter.ai/api/v1/models");
    if (!r.ok) return { errore: `Elenco modelli ${r.status}` };
    const corpo = (await r.json()) as {
      data?: { id?: string; architecture?: { output_modalities?: string[] } }[];
    };
    const ids = (corpo.data || [])
      .filter((m) => (m.architecture?.output_modalities || []).includes("image"))
      .map((m) => m.id || "")
      //  «openrouter/auto» è un instradatore, non un modello: non garantisce
      //  che quello che risponde sappia restituire un'immagine.
      .filter((id) => id && !id.startsWith("openrouter/auto"));
    for (const p of PREFERITI) {
      const trovato = ids.find((id) => id === p) || ids.find((id) => id.startsWith(p));
      if (trovato) {
        scelto = { id: trovato, quando: Date.now() };
        return { modello: trovato };
      }
    }
    if (ids.length) {
      scelto = { id: ids[0], quando: Date.now() };
      return { modello: ids[0] };
    }
    return { errore: "Nessun modello capace di restituire un'immagine" };
  } catch (e) {
    return { errore: `Elenco modelli non raggiungibile: ${String((e as Error).message || e)}` };
  }
}

/** ⚠️ La chiave arriva dalle IMPOSTAZIONI del gestionale, e solo in mancanza
 *  di quelle dalla variabile d'ambiente. È il motivo per cui questa porta
 *  pubblica importa una cosa dalla parte riservata: la configurazione è una
 *  sola, e due posti da tenere allineati a mano sono due posti che prima o poi
 *  dicono cose diverse. */
/** ── ⚠️ IL GUASTO SI DICE IN ITALIANO ─────────────────────────────────────
 *  In pagina finiva il JSON di OpenRouter tale e quale — un muro di parentesi
 *  graffe davanti a un cliente, che sembra un sito rotto e non dice comunque
 *  cosa fare. Le tre cause vere hanno tre frasi, e ognuna dice il rimedio. Il
 *  testo tecnico resta in `dettaglio`, che la pagina mostra piccolo e sotto:
 *  serve a chi corregge, non a chi guarda. */
function spiegaGuasto(stato: number, grezzo: string): { errore: string; dettaglio: string } {
  if (stato === 402 || /more credits|insufficient/i.test(grezzo)) {
    return {
      errore: "Il credito per generare le immagini è finito.",
      dettaglio: "Va ricaricato su openrouter.ai → Credits. Finché è a zero, nessuna prova può partire.",
    };
  }
  if (stato === 401 || stato === 403) {
    return {
      errore: "La chiave per generare le immagini non è più valida.",
      dettaglio: "Va rifatta dal gestionale, in Impostazioni → Intelligenza artificiale.",
    };
  }
  if (stato === 429) {
    return {
      errore: "Troppe richieste in questo momento.",
      dettaglio: "Aspetta qualche secondo e premi «Riprova».",
    };
  }
  return { errore: "La prova non è andata a buon fine.", dettaglio: grezzo.slice(0, 300) };
}

/** ── LEGGERE IL TAGLIO DELLA FOTO ──────────────────────────────────────────
 *  Un giro in più prima di generare, e costa un millesimo di un'immagine: si
 *  chiede a un modello di testo di DESCRIVERE il taglio della fotografia di
 *  riferimento, e la descrizione entra nel testo insieme alla foto.
 *  ⚠️ SERVE PERCHÉ UNA FOTOGRAFIA È AMBIGUA. Con la sola immagine il taglio
 *   usciva somigliante ma non uguale: il ciuffo c'era, i lati rasati no — nel
 *   dubbio il modello conserva quello che trova già sulla testa. «Lati sfumati
 *   a zero sopra l'orecchio», scritto, non si può interpretare.
 *  ⚠️ E SE FALLISCE NON FERMA NIENTE: si torna alla sola fotografia, che è
 *   come funzionava prima. Un giro d'aiuto non può impedire la prova. */
async function leggiIlTaglio(chiave: string, modello: string, foto: string): Promise<string> {
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${chiave}` },
      body: JSON.stringify({
        model: modello,
        max_tokens: 220,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Describe ONLY the haircut in this photo, in one dense English sentence of at most "
                + "60 words, as a barber would specify it to another barber. Cover, in this order: "
                + "length and finish at the sides and back (fade, undercut, tapered, left long), "
                + "length and volume on top, styling direction, parting, texture, and fringe. Do "
                + "not mention the person, their face, their build, the colour of the hair, the "
                + "lighting or the background. Reply with the description only.",
            },
            { type: "image_url", image_url: { url: foto } },
          ],
        }],
      }),
    });
    if (!r.ok) return "";
    const b = (await r.json()) as { choices?: { message?: { content?: unknown } }[] };
    const c = b.choices?.[0]?.message?.content;
    const testo = typeof c === "string"
      ? c
      : Array.isArray(c)
        ? c.map((p) => (p as { text?: string })?.text || "").join(" ")
        : "";
    return testo.trim().slice(0, 400);
  } catch {
    return "";
  }
}

/** ── LA CLASSIFICA STA IN `app_config` E NON IN UNA TABELLA SUA ────────────
 *  Sono contatori: quattro numeri e due date, non una riga per prova. Una
 *  tabella nuova avrebbe voluto dire una migrazione da lanciare a mano prima
 *  che la pagina potesse contare anche solo una scelta — e una funzione che
 *  aspetta di essere accesa da qualcun altro, in pratica, non conta mai
 *  niente.
 *  ⚠️ IL LIMITE, DETTO: si legge e si riscrive tutto insieme, quindi due prove
 *   finite nello stesso istante possono contarne una sola. Su questa pagina è
 *   una perdita accettabile — la classifica serve a dire QUALE taglio va
 *   forte, non a fatturare. Se un giorno le prove diventano tante, si passa a
 *   una tabella con una riga per prova e questa funzione cambia da sola. */
export const CHIAVE_CLASSIFICA = "prova_capelli_classifica";

export async function leggiClassifica(): Promise<Conteggi> {
  try {
    const { data } = await supabaseAdmin
      .from("app_config").select("value").eq("key", CHIAVE_CLASSIFICA).maybeSingle();
    const v = JSON.parse((data as { value?: string } | null)?.value ?? "null");
    return v && typeof v === "object" ? { ...VUOTO, ...v } : { ...VUOTO };
  } catch {
    return { ...VUOTO };
  }
}

async function segnaScelta(s: { taglio: string; colore: string; daFoto: boolean }): Promise<void> {
  const prima = await leggiClassifica();
  const dopo = conta(prima, s, new Date().toISOString());
  await supabaseAdmin.from("app_config").upsert(
    { key: CHIAVE_CLASSIFICA, value: JSON.stringify(dopo), updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
}

async function configurazione(): Promise<{ chiave: string; modello: string }> {
  const c = await leggiConfigAI();
  return { chiave: c.pronto ? c.apiKey : "", modello: c.modello };
}

export const Route = createFileRoute("/api/public/prova-capelli")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      //  ── SI PUÒ PROVARE? ────────────────────────────────────────────────
      //   La pagina lo chiede prima di mostrare il modulo: se manca la chiave,
      //   far caricare una foto e poi dire «non configurato» è il modo peggiore
      //   di dirlo.
      GET: async ({ request }) => {
        /** ── COM'È MESSO QUESTO CODICE ────────────────────────────────────
         *  La pagina lo chiede appena la persona lo scrive, prima di farle
         *  caricare una foto: scoprire che il codice è finito DOPO aver
         *  scelto taglio e colore è il modo di far chiudere la pagina. */
        const parametri = new URL(request.url).searchParams;
        //  Il catalogo intero: i tagli del codice più quelli aggiunti dopo.
        if (parametri.get("azione") === "catalogo") {
          return json({ ok: true, tagli: await catalogoIntero() });
        }
        //  Una prova sola, per id: è quello che serve quando si riapre il
        //  link con `?p=` — la pagina ricarica il risultato invece di
        //  ricominciare da capo.
        const unaSola = parametri.get("anteprima") || "";
        if (unaSola) {
          const a = await trovaAnteprima(unaSola);
          return a ? json({ ok: true, anteprima: a }) : json({ ok: false, errore: "non trovata" }, 404);
        }
        //  Tutte quelle di un codice: la galleria che sopravvive al
        //  ricaricamento della pagina.
        const perCodice = parametri.get("anteprime") || "";
        if (perCodice) {
          return json({
            ok: true,
            anteprime: await anteprimeDi(perCodice, { meet: parametri.get("meet") || "" }),
          });
        }

        //  Il numero a cui scrivere dal risultato: lo legge la pagina, e se
        //  non c'è il tasto WhatsApp semplicemente non compare.
        //  ⚠️ I campioni fotografici dei colori: la pagina li chiede una volta
        //   e li mostra al posto della tinta piena, dove ci sono. Sta qui e non
        //   dentro `catalogo` perché il catalogo è dei TAGLI: mescolarli
        //   vorrebbe dire che una modifica ai colori invalida la cache dei
        //   tagli, e viceversa.
        if (parametri.get("azione") === "campioni") {
          return json({ ok: true, campioni: await campioni() });
        }

        if (parametri.get("azione") === "contatto") {
          try {
            const { data } = await supabaseAdmin
              .from("app_config").select("value").eq("key", "prova_capelli_contatto").maybeSingle();
            const c = JSON.parse((data as { value?: string } | null)?.value ?? "{}") || {};
            return json({ ok: true, numero: String(c.numero || ""), messaggio: String(c.messaggio || "") });
          } catch {
            return json({ ok: true, numero: "", messaggio: "" });
          }
        }

        const chiesto = parametri.get("codice") || "";
        if (chiesto) {
          const scheda = await trovaCodice(chiesto);
          const v = puoProvare(scheda);
          return json({
            ok: v.ok,
            codice: scheda ? leggibile(scheda.codice) : "",
            restano: v.restano,
            errore: v.perche,
            puoComprare: !!v.puoComprare,
            //  Il nome serve a salutare per nome e a precompilare il
            //  pagamento: è già nostro, l'abbiamo scritto noi creando il
            //  codice.
            nome: scheda?.nome || "",
            cognome: scheda?.cognome || "",
            email: scheda?.email || "",
            telefono: scheda?.telefono || "",
            //  Chi ha un codice admin vede in più il tasto per aggiungere un
            //  taglio: agli altri non deve nemmeno comparire.
            admin: !!scheda?.admin,
            //  ⚠️ La scheda a cui il codice è già legato: serve alla pagina
            //   per dire A CHI sta per mandare le prove. Un tasto «invia alla
            //   scheda» senza il nome di chi la riceve è un tasto che nessuno
            //   preme la prima volta.
            leadId: scheda?.leadId || "",
            //  ⚠️ CHI HA PAGATO NON HA LA FILIGRANA, ed è il primo vantaggio
            //   del pacchetto — quello che si capisce senza spiegazioni.
            //   «Ha pagato» vuol dire che il totale delle prove è cresciuto
            //   oltre quelle comprese: è l'unico segno che non si può
            //   confondere con un regalo fatto a mano dallo studio.
            senzaFiligrana: !!scheda?.admin || Number(scheda?.totali || 0) > PROVE_COMPRESE,
          });
        }

        //  ⚠️ SI CONTROLLA CHE SIA PIENA, non che esista. Il segreto era stato
        //   caricato VUOTO: il nome c'era, il valore no, e «esiste» rispondeva
        //   di sì mentre ogni generazione sarebbe fallita al primo tentativo.
        const cfg = await configurazione();
        if (!cfg.chiave) {
          return json({
            ok: false,
            errore: "Manca la chiave OpenRouter: si imposta dal gestionale, in Impostazioni → Intelligenza artificiale.",
          });
        }
        const m = await modelloBuono(cfg.modello);
        return m.modello
          ? json({ ok: true, modello: m.modello })
          : json({ ok: false, errore: m.errore || "Nessun modello disponibile" });
      },

      POST: async ({ request }) => {
        /** ── CANCELLARE UNA PROVA, O VENTI ──────────────────────────────
         *  ⚠️ STA PRIMA DEL CONTROLLO DELLA CHIAVE. Cancellare non chiama
         *   nessun modello: chiedere la chiave di OpenRouter per buttare via
         *   una fotografia vorrebbe dire non poterla buttare via proprio il
         *   giorno in cui la chiave manca o è scaduta — cioè il giorno in cui
         *   uno se ne ricorda.
         *  ⚠️ E il permesso è il CODICE, non l'id: si cancellano solo le
         *   prove di chi lo chiede. Vedi `eliminaAnteprime`. */
        if (new URL(request.url).searchParams.get("azione") === "elimina") {
          let e: { codice?: string; ids?: string[] } = {};
          try {
            e = (await request.json()) as typeof e;
          } catch {
            return json({ ok: false, errore: "Richiesta illeggibile" }, 400);
          }
          const suo = String(e.codice || "");
          if (!(await trovaCodice(suo))) return json({ ok: false, errore: "Codice non valido" }, 403);
          //  ⚠️ Un tetto agli id: è una lista che arriva da fuori e ogni voce
          //   è un giro sull'elenco intero.
          const ids = Array.isArray(e.ids) ? e.ids.map(String).slice(0, 200) : [];
          return json({ ok: true, tolte: await eliminaAnteprime(suo, ids) });
        }

        const cfg = await configurazione();
        const k = cfg.chiave;
        if (!k) {
          return json(
            { ok: false, errore: "Manca la chiave OpenRouter: si imposta dal gestionale, in Impostazioni → Intelligenza artificiale." },
            503,
          );
        }

        let b: {
          foto?: string;
          taglio?: string;
          colore?: string;
          calvo?: boolean;
          /** provare anche la barba: spenta di suo */
          barba?: boolean;
          /** quanta parte dei capelli è bianca e quanta grigia (0-100) */
          bianchi?: number;
          grigi?: number;
          /** le modifiche standard scelte e la riga scritta a mano */
          ritocchi?: string[];
          nota?: string;
          /** ⚠️ La foto del taglio arriva dal CATALOGO, non dal telefono: è la
           *  stessa immagine che la persona ha toccato. Vedi sotto perché
           *  cambia tutto. */
          dalCatalogo?: boolean;
          chi?: string;
          /** il codice d'accesso: senza, non si genera niente */
          codice?: string;
          /** la seconda foto, quella da cui prendere SOLO il colore */
          fotoColore?: string;
          /** la foto del taglio da riprodurre, quando non lo si sceglie
           *  dall'elenco */
          fotoTaglio?: string;
          taglioDaFoto?: boolean;
          /** la fotografia allegata è un ESEMPIO di capelli veri, non il
           *  taglio da riprodurre: vedi ruoliImmagini */
          esempioReale?: boolean;
          /** il taglio composto dalle opzioni, quando non si sceglie né
           *  dall'elenco né da una fotografia */
          composto?: Composto;
          /** i laterali scelti a parte, e se la sfumatura va fino alla pelle */
          laterali?: string;
          pelle?: boolean;
          /** il codice della consulenza: le prove di un Meetly restano sue */
          meet?: string;
        };
        try {
          b = (await request.json()) as typeof b;
        } catch {
          return json({ ok: false, errore: "Richiesta illeggibile" }, 400);
        }

        //  ⚠️ O un taglio dell'elenco O la foto di un taglio: uno dei due deve
        //   esserci, e senza nessuno dei due il testo uscirebbe monco — cioè
        //   una generazione pagata per un risultato a caso.
        const fotoTaglio = String(b.fotoTaglio || "");
        const dallaFotoIlTaglio = !!b.taglioDaFoto && !!fotoTaglio;
        /** ⚠️ L'esempio di realismo vale SOLO per un taglio composto: allegarlo
         *  a un taglio del catalogo vorrebbe dire mettere accanto alla
         *  fotografia giusta una seconda fotografia somigliante, e il modello
         *  fra due ne sceglie una a caso. */
        const conEsempio = !!b.esempioReale && !!fotoTaglio && !dallaFotoIlTaglio;
        //  ⚠️ Si cerca anche fra i tagli AGGIUNTI dal catalogo, non solo fra
        //   quelli scritti nel codice: un taglio che si vede nella griglia e
        //   poi non funziona è il difetto peggiore, perché si scopre dopo aver
        //   caricato la propria faccia.
        const t = await tagliaOvunque(String(b.taglio || ""));
        /** ⚠️ Il taglio SU MISURA è il terzo modo di dire che taglio si vuole,
         *  accanto all'elenco e alla fotografia. Si controlla che sia pieno —
         *  lunghezza e capello — perché senza quei due la descrizione esce
         *  monca e il modello riempie il buco con i capelli che la persona ha
         *  già, che è il difetto per cui questa pagina esiste. */
        const suMisura = compostoPieno(b.composto) ? b.composto : undefined;
        if (!t && !dallaFotoIlTaglio && !suMisura) {
          return json({ ok: false, errore: "Taglio non riconosciuto" }, 400);
        }
        if (dallaFotoIlTaglio || conEsempio) {
          const rif = fotoAccettabile(fotoTaglio);
          if (!rif.ok) return json({ ok: false, errore: `Foto del taglio: ${rif.perche}` }, 400);
        }

        const foto = String(b.foto || "");
        const buona = fotoAccettabile(foto);
        if (!buona.ok) return json({ ok: false, errore: buona.perche }, 400);

        //  ── LA FOTO DEL COLORE ─────────────────────────────────────────
        //   ⚠️ Si controlla con lo STESSO metro della prima: è un'immagine che
        //    arriva da fuori esattamente come quella, e un controllo più
        //    morbido sulla seconda vanificherebbe quello sulla prima.
        //   ⚠️ E se il colore è «da una foto» ma la foto non c'è, si dice
        //    adesso: mandare due immagini quando ne serve una sola fa uscire
        //    un colore inventato, e nessuno capirebbe perché.
        const fotoColore = String(b.fotoColore || "");
        const vuoleDaFoto = String(b.colore || "") === COLORE_DA_FOTO;
        if (vuoleDaFoto) {
          if (!fotoColore) {
            return json({ ok: false, errore: "Manca la foto da cui prendere il colore." }, 400);
          }
          const seconda = fotoAccettabile(fotoColore);
          if (!seconda.ok) return json({ ok: false, errore: `Foto del colore: ${seconda.perche}` }, 400);
        }

        //  Chi è: l'identificativo che si è dato il browser, oppure l'indirizzo
        //  da cui arriva. Serve SOLO a contare, non identifica nessuno.
        const chi =
          String(b.chi || "").slice(0, 64) ||
          request.headers.get("cf-connecting-ip") ||
          "sconosciuto";
        /** ── ⚠️ SI ENTRA CON UN CODICE ─────────────────────────────────
         *  Non è più una pagina aperta: il codice lo diamo noi su WhatsApp,
         *  porta tre prove comprese, e finite quelle se ne comprano altre.
         *  ⚠️ Il controllo sta QUI, prima di qualunque spesa: una generazione
         *   costa dieci centesimi veri, e una porta aperta su internet li
         *   spende tutti in una notte.
         *  ⚠️ E i tre no sono TRE messaggi diversi — codice inesistente,
         *   codice spento, prove finite — perché la cosa da fare è diversa in
         *   tutti e tre i casi. Vedi `puoProvare`. */
        const codice = String(b.codice || "");
        if (!formaValida(codice)) {
          return json({ ok: false, errore: "Serve il codice che ti abbiamo mandato su WhatsApp.", serveCodice: true }, 401);
        }
        const scheda = await trovaCodice(codice);
        const verdetto = puoProvare(scheda);
        if (!verdetto.ok) {
          return json(
            { ok: false, errore: verdetto.perche, puoComprare: !!verdetto.puoComprare, serveCodice: !scheda },
            verdetto.puoComprare ? 402 : 401,
          );
        }

        //  Il tetto per visitatore resta come rete di sicurezza: protegge dal
        //  codice finito in un gruppo Telegram, che è successo a chiunque
        //  abbia mai regalato un codice.
        const tetto = passaIlTetto(chi);
        if (!tetto.ok) {
          return json(
            { ok: false, errore: `Hai già fatto ${TETTO_AL_GIORNO} prove oggi. Riprova domani.` },
            429,
          );
        }

        const m = await modelloBuono(cfg.modello);
        if (!m.modello) return json({ ok: false, errore: m.errore || "Nessun modello disponibile" }, 502);

        //  ⚠️ Si legge PRIMA di generare, e solo quando serve: senza foto del
        //   taglio non c'è niente da leggere, e un giro in più a vuoto è tempo
        //   che la persona passa a guardare un cerchietto che gira.
        /** ── ⚠️ IL TAGLIO DEL CATALOGO VIAGGIA ANCHE COME IMMAGINE ────────
         *  DIFETTO SEGNALATO: «il taglio che seleziono non lo applica al 100%,
         *  cambia dei particolari». La causa era che di un taglio del catalogo
         *  al modello arrivava SOLO una frase — mentre di un taglio caricato
         *  dalla persona arrivava la fotografia, e infatti quello veniva
         *  replicato bene. Le parole descrivono, una fotografia vincola.
         *  Adesso la pagina manda anche il riquadro che la persona ha toccato,
         *  e il modello ha davanti la stessa immagine che ha visto lei.
         *  ⚠️ E la descrizione NON si va a leggere con un secondo modello: di
         *   un taglio nostro le parole giuste le abbiamo già scritte noi nel
         *   catalogo. Si risparmia una chiamata e si guadagna precisione. */
        const descrizioneTaglio = b.dalCatalogo
          ? String(t?.inglese || "")
          : dallaFotoIlTaglio
            ? await leggiIlTaglio(cfg.chiave, "google/gemini-2.5-flash", fotoTaglio)
            : "";

        const prompt = costruisciPrompt({
          taglio: t?.chiave || "",
          composto: suMisura,
          //  ⚠️ Si accetta solo una chiave conosciuta: qui dentro finisce una
          //   riga scritta a un modello, e una stringa arrivata dal telefono
          //   sarebbe un'istruzione libera pagata da noi.
          laterali: trovaLaterale(String(b.laterali || "")) ? String(b.laterali) : "",
          pelle: !!b.pelle,
          colore: String(b.colore || ""),
          calvo: !!b.calvo,
          taglioDaFoto: dallaFotoIlTaglio,
          esempioReale: conEsempio,
          descrizioneTaglio,
          barba: !!b.barba,
          //  ⚠️ Si ripuliscono QUI, non ci si fida di quello che arriva: sono
          //   due numeri che finiscono dentro una frase mandata al modello, e
          //   un «200%» o un testo al posto della cifra farebbero uscire
          //   un'istruzione senza senso — pagata.
          bianchi: Math.max(0, Math.min(100, Math.round(Number(b.bianchi) || 0))),
          grigi: Math.max(0, Math.min(100, Math.round(Number(b.grigi) || 0))),
          ritocchi: Array.isArray(b.ritocchi) ? b.ritocchi.map(String).slice(0, 8) : [],
          nota: notaPulita(b.nota),
        });

        try {
          const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${k}`,
              "HTTP-Referer": "https://hair-genius-hub.hair",
              "X-Title": "Prova capelli",
            },
            body: JSON.stringify({
              model: m.modello,
              modalities: ["image", "text"],
              /** ── ⚠️ UN TETTO ALLA RICHIESTA, E NON È SOLO RISPARMIO ────
               *  Senza, si chiede il massimo che il modello sa dare — 57.000
               *  token — e OpenRouter riserva il credito per TUTTI quelli
               *  prima di cominciare: con pochi euro sul conto la richiesta
               *  viene rifiutata in partenza, anche se poi ne servirebbero
               *  duemila. È esattamente l'errore 402 che si è visto in
               *  pagina: «hai chiesto fino a 57603, puoi permetterne 12285».
               *  ⚠️ Ottomila bastano: un'immagine costa poco più di mille
               *   token, il resto è margine. Alzarlo non migliora la foto —
               *   la peggiora soltanto quando il credito è agli sgoccioli. */
              max_tokens: 8000,
              //  ⚠️ Si chiede a OpenRouter QUANTO È COSTATA questa immagine:
              //   così la spesa segnata sul codice è quella vera e non una
              //   stima che invecchia al primo cambio di listino.
              usage: { include: true },
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: prompt },
                    //  ⚠️ L'ORDINE CONTA: la persona è la PRIMA immagine, il
                    //   riferimento di colore la seconda, e il testo lo dice
                    //   con quelle parole. Invertendole, il modello rifà la
                    //   faccia del riferimento — che è l'errore peggiore
                    //   possibile qui dentro.
                    //  ⚠️ E L'ORDINE È QUELLO DICHIARATO NEL TESTO: persona,
                    //   poi il taglio, poi il colore. `ruoliImmagini` numera i
                    //   ruoli con questa stessa sequenza — invertirli qui vuol
                    //   dire dire al modello che la faccia da tenere è
                    //   un'altra.
                    { type: "image_url", image_url: { url: foto } },
                    ...(dallaFotoIlTaglio || conEsempio
                      ? [{ type: "image_url", image_url: { url: fotoTaglio } }]
                      : []),
                    ...(vuoleDaFoto ? [{ type: "image_url", image_url: { url: fotoColore } }] : []),
                  ],
                },
              ],
            }),
          });

          if (!r.ok) {
            const grezzo = (await r.text()).slice(0, 500);
            //  ⚠️ IL GUASTO SI DICE IN ITALIANO. Prima in pagina finiva il JSON
            //   di OpenRouter tale e quale: davanti a un cliente è un muro di
            //   parentesi graffe che sembra un sito rotto, e a chi lo legge non
            //   dice comunque cosa fare. Le tre cause vere hanno tre frasi, e
            //   ognuna dice il rimedio.
            return json({ ok: false, ...spiegaGuasto(r.status, grezzo) }, 502);
          }

          const corpo = (await r.json()) as {
            choices?: {
              message?: {
                images?: { image_url?: { url?: string }; url?: string }[];
                content?: unknown;
                refusal?: string;
              };
              finish_reason?: string;
            }[];
          };
          const msg = corpo.choices?.[0]?.message;
          const url = msg?.images?.[0]?.image_url?.url || msg?.images?.[0]?.url;
          if (typeof url === "string" && url.startsWith("data:image")) {
            //  ⚠️ SI SEGNA SOLO QUANDO È ANDATA BENE. Contare anche i
            //   tentativi falliti vorrebbe dire una classifica in cui il
            //   taglio più «scelto» è quello che si rompe di più.
            //  ⚠️ E non blocca la risposta: la persona ha la sua foto, e un
            //   contatore non può farla aspettare né farla fallire.
            void segnaScelta({
              taglio: dallaFotoIlTaglio ? "" : String(b.taglio || ""),
              colore: String(b.colore || "come_barba"),
              daFoto: dallaFotoIlTaglio,
            }).catch(() => { /* la prova vale più del conteggio */ });

            //  ⚠️ Si scala DOPO che l'immagine è arrivata: scalare prima vuol
            //   dire far pagare una prova a chi ha ricevuto un errore, ed è
            //   il genere di cosa per cui una persona scrive una recensione.
            //  Il costo arriva in dollari: si converte in centesimi di euro
            //  con un cambio fisso e dichiarato. ⚠️ Non serve la precisione di
            //  un cambio vero — serve un ordine di grandezza onesto per capire
            //  quanto sta costando la vetrina.
            const dollari = Number((corpo as { usage?: { cost?: number } }).usage?.cost || 0);
            const restanoDavvero = await consumaProva(codice, dollari > 0 ? dollari * 92 : COSTO_STIMATO);

            /** ── ⚠️ OGNI PROVA SI TIENE, E HA UN NOME ────────────────────
             *  Prima l'immagine viveva solo nella scheda del browser: un
             *  ricaricamento e spariva. Adesso finisce su Storage con un id
             *  che va nell'indirizzo — si riapre il link e il risultato è
             *  ancora lì, anche domani, anche da un altro telefono.
             *  ⚠️ Si salva SENZA filigrana: il marchio lo mette la pagina, e
             *   chi ha comprato deve poterla riscaricare pulita.
             *  ⚠️ E se il salvataggio fallisce NON si perde la prova: si
             *   restituisce l'immagine com'è. Una prova pagata non può
             *   dipendere dal fatto che un archivio risponda. */
            let dove = url;
            let id = "";
            try {
              id = `A${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
              dove = await salvaImmagine(`prova-${id}`, url);
              await salvaAnteprima({
                id,
                codice: normalizza(codice),
                immagine: dove,
                taglio: String(b.taglio || (dallaFotoIlTaglio ? "dalla tua foto" : "")),
                colore: String(b.colore || ""),
                quando: new Date().toISOString(),
                //  ⚠️ La consulenza in cui è nata: fa sì che «le tue foto» di
                //   un Meetly contenga solo quel Meetly. Vedi archivio.server.
                ...(b.meet ? { meet: String(b.meet).slice(0, 40) } : {}),
              });

              /** ── ⚠️ E FINISCE DA SOLA SULLA SCHEDA DEL CLIENTE ─────────
               *  Il tasto «salva sulla scheda» c'era, ma chiedeva a una
               *  persona di fare un gesto per NOI: a lei non serve — le foto
               *  le ha già — mentre a chi la richiamerà fra un mese serve
               *  moltissimo. Un lavoro che serve a noi non si chiede al
               *  cliente: si fa.
               *  ⚠️ Solo se il codice è collegato a un lead, e in silenzio: se
               *   fallisce, la prova è comunque salvata e visibile — non si
               *   rovina una generazione riuscita per un aggiornamento di
               *   scheda andato storto. */
              if (scheda?.leadId) {
                void attaccaAlLead(scheda.leadId, {
                  immagine: dove,
                  taglio: String(b.taglio || ""),
                  colore: String(b.colore || ""),
                  quando: new Date().toISOString(),
                  codice: scheda.codice,
                }).catch(() => { /* la scheda si sistema dopo */ });
              }
            } catch {
              id = "";
              dove = url;
            }

            return json({ ok: true, immagine: dove, id, restano: restanoDavvero });
          }

          //  ⚠️ NIENTE IMMAGINE NON È SEMPRE UN GUASTO: a volte il modello si
          //   rifiuta e SPIEGA perché (una foto che non contiene una faccia, per
          //   esempio). Quella spiegazione va riportata: senza, la pagina dice
          //   «riprova» all'infinito su una foto che non andrà mai bene.
          const testo =
            typeof msg?.content === "string"
              ? msg.content
              : Array.isArray(msg?.content)
                ? (msg?.content as { text?: string }[]).map((p) => p?.text || "").join(" ").trim()
                : "";
          return json(
            {
              ok: false,
              errore: "Il modello non ha restituito un'immagine.",
              dettaglio: (msg?.refusal || testo || corpo.choices?.[0]?.finish_reason || "").slice(0, 300),
            },
            502,
          );
        } catch (e) {
          return json({ ok: false, errore: String((e as Error).message || e) }, 502);
        }
      },
    },
  },
});
