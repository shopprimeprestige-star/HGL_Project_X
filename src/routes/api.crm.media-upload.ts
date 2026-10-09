/** ── IL PERMESSO PER CARICARE UNA FOTO O UN VIDEO DEL CLIENTE ──────────────
 *
 *  POST { mime, peso, nome? }
 *    -> { ok, bucket, path, token, url, kind, caricatoDa }
 *    -> { ok:false, reason }   ← una frase in italiano, da MOSTRARE
 *
 *  Non passa un byte da qui. Questa rotta consegna al browser un permesso a
 *  termine per scrivere UN file, e il file va dal telefono allo Storage in
 *  linea diretta (`uploadToSignedUrl`, come già fa `caricaDiretto` in
 *  src/shop/call.tsx). È l'unica strada possibile: su Cloudflare Workers un
 *  file che attraversa il servizio ci arriva INTERO in memoria, e sopra gli 8
 *  MB la richiesta muore a metà senza dire perché — con i video di posa girati
 *  col telefono sarebbe la regola, non l'eccezione. Non c'è nemmeno una seconda
 *  strada per le foto piccole: due strade sono due comportamenti che un giorno
 *  divergono, e la strada firmata funziona benissimo anche per un JPEG.
 *
 *  ── PERCHÉ UNA ROTTA NUOVA E NON api.presenter.upload-url ─────────────────
 *  Quella rotta chiede una sessione da PRESENTATORE (cookie hg_psess,
 *  x-presenter-token o un codice consulente): nessuna delle tre esiste in una
 *  pagina del CRM, quindi da lì risponderebbe 401 — e lo farebbe in silenzio,
 *  perché nessuna pagina CRM legge quel corpo. Si sarebbe potuta aggiungere una
 *  seconda porta come ha fatto api.anteprima; non si è fatto perché servivano
 *  comunque DUE comportamenti diversi nello stesso posto (il nome del file, il
 *  bucket, i tipi ammessi), e due comportamenti in una rotta sola sono il modo
 *  in cui una rotta smette di essere leggibile.
 *
 *  ── CHI PUÒ ───────────────────────────────────────────────────────────────
 *  `guardiaCRM(..., "installazioni")`: è il ramo in cui il portafoglio nasce —
 *  si carica dalla scheda del cliente e lo si guarda dalle righe delle pose.
 *  ⚠️ Se un domani il pulsante comparisse anche nelle liste lead generali o
 *   nell'area mobile del consulente (routes/consulente.leads.tsx, che NON porta
 *   le intestazioni del CRM), questo permesso va rivisto QUI: altrimenti si
 *   scopre dal fatto che a qualcuno il caricamento non riesce, e la frase che
 *   legge parla di un permesso che non sa di non avere.
 *
 *  ── ⚠️ QUESTI SONO DATI PERSONALI, E LO SPAZIO È PUBBLICO ─────────────────
 *  Sono foto di teste, prima e dopo, spesso con il volto. Il bucket nasce qui
 *  con `public: true`: chi conosce l'indirizzo apre il file senza nessuna
 *  credenziale, PER SEMPRE, e togliere la voce dalla scheda non cancella
 *  niente. È una decisione che il committente deve poter rivedere, quindi è
 *  scritta in chiaro; nel frattempo tutto ciò che si poteva fare senza cambiare
 *  quella decisione è stato fatto:
 *
 *   · IL PERCORSO È SORTEGGIATO col generatore crittografico (`generaCodice`,
 *     12 segni su 23 = più di 54 bit), NON con Math.random più l'orario come
 *     fanno le due rotte del presentatore: cinque caratteri da un generatore
 *     non crittografico più un orario in millisecondi sono un indirizzo che si
 *     può cercare, e qui cercare significa trovare la foto di un cliente;
 *   · IL NOME ORIGINALE DEL FILE NON ENTRA NELL'INDIRIZZO. Nelle rotte del
 *     presentatore ci finisce, e per queste foto il nome originale è
 *     spessissimo il nome della persona (`rossi-dopo-3mesi.jpg`): sarebbe un
 *     dato personale scritto dentro un url che si apre senza credenziali. Qui
 *     l'estensione si ricava dal TIPO dichiarato, e del nome non resta niente;
 *   · NIENTE ID DEL LEAD E NIENTE CARTELLE PER CLIENTE nel percorso, per lo
 *     stesso motivo: un indirizzo non deve dire di chi è la foto, e due file
 *     nella stessa cartella non devono dire che sono della stessa persona;
 *   · UN BUCKET TUTTO SUO, separato da quello delle registrazioni. Serve
 *     proprio a rendere possibile il ripensamento: il giorno in cui si sceglie
 *     la via pulita — bucket PRIVATO e indirizzi a scadenza generati da
 *     `createSignedUrl` dietro `guardiaCRM` — si cambia UN'impostazione su
 *     questo bucket senza spegnere i link delle consulenze registrate. Il costo
 *     di quella scelta, da dire al committente: gli indirizzi scadono, quindi
 *     non si incollano in un messaggio e non servono per un link /media/CODICE
 *     da mandare al cliente.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generaCodice } from "@/media/galleria";
import { controllaFile } from "@/crm/portfolio/dati";
import { guardiaCRM } from "./api.crm.accesso";

//  Le credenziali del CRM vanno DICHIARATE qui: `Authorization` per chi è
//  entrato con l'account padrone, `x-crm-token` per chi è entrato col PIN.
//  Senza questa riga il browser non le lascia nemmeno partire quando la
//  chiamata arriva da un'altra origine, e il rifiuto sembrerebbe una sessione
//  scaduta. (Stessa nota in api.presenter.quote-owner.ts.)
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

/** ⚠️ Bucket dedicato, non 'presenter-videos'. Il perché è in testa al file:
 *  è ciò che rende reversibile la scelta di tenerlo pubblico. */
const BUCKET = "clienti-media";

/** ── IL TETTO VERO ────────────────────────────────────────────────────────
 *  Questo è l'unico limite che nessuno può aggirare, perché lo applica lo
 *  Storage sul file vero. I due tetti di crm/portfolio/dati.ts (25 MB per una
 *  foto, 500 MB per un video) sono più stretti ma si basano sul peso che il
 *  browser DICHIARA, e una dichiarazione si può falsificare: servono a dirlo
 *  prima e con una frase che si capisce, non a difendere lo spazio. Qui si sta
 *  larghi il giusto — sopra c'è solo chi ci sta usando come deposito.
 *  ⚠️ Il limite si fissa ALLA CREAZIONE del bucket: se il bucket esiste già con
 *   un tetto più basso, questa costante non lo alza. Si alza da Supabase →
 *   Storage → clienti-media → Settings, ed è esattamente quello che dice la
 *   frase di rifiuto, così chi la legge sa dove andare. */
const LIMITE_BUCKET = 1024 * 1024 * 1024;
const mb = (n: number) => Math.round(n / (1024 * 1024));

/** Il bucket esiste? Se no lo si crea largo, e se il progetto non consente un
 *  tetto così alto si ripiega su quello di default (meglio del nulla). Torna il
 *  tetto in vigore, che è quello che conta per il rifiuto anticipato.
 *  Stessa forma di api.presenter.upload-url: il modello è già in casa. */
async function tettoDelBucket(): Promise<number> {
  try {
    const { data: info } = await supabaseAdmin.storage.getBucket(BUCKET);
    if (info) return Number(info.file_size_limit) || 0;
    const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: LIMITE_BUCKET,
    });
    if (error) await supabaseAdmin.storage.createBucket(BUCKET, { public: true });
    const { data: dopo } = await supabaseAdmin.storage.getBucket(BUCKET);
    return Number(dopo?.file_size_limit) || 0;
  } catch {
    //  Non si riesce a leggerlo: si lascia decidere allo Storage, che il file lo
    //  vede davvero. Meglio un rifiuto tardivo di un rifiuto inventato.
    return 0;
  }
}

export const Route = createFileRoute("/api/crm/media-upload")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "installazioni");
        if (!g.ok) return g.risposta;

        //  Il corpo arriva dalla rete: può essere `null`, un numero, una
        //  stringa. Se non è un oggetto non si indovina niente — qui l'unico
        //  campo che serve davvero è il tipo, e senza quello non si può
        //  nemmeno scegliere l'estensione.
        let b: { mime?: unknown; peso?: unknown; nome?: unknown } = {};
        try {
          const grezzo = await request.json();
          if (grezzo && typeof grezzo === "object") b = grezzo as typeof b;
        } catch {
          return json({ ok: false, reason: "Richiesta illeggibile: riprova." }, 400);
        }

        //  ⚠️ LO STESSO CONTROLLO CHE HA GIÀ FATTO IL BROWSER, RIFATTO QUI.
        //  Non è una ripetizione inutile: il controllo del browser serve a non
        //  far aspettare per niente, questo serve perché il browser si può
        //  scavalcare. La regola però è UNA SOLA e sta in crm/portfolio/dati.ts
        //  — due controlli gemelli sono due controlli che un giorno dicono cose
        //  diverse, e quel giorno da una parte passa un file che dall'altra è
        //  vietato.
        const esito = controllaFile({ mime: b.mime, peso: b.peso });
        if (!esito.ok) {
          //  415 = tipo sbagliato, 413 = troppo pesante: due codici perché sono
          //  due rimedi diversi. La distinzione la dichiara `causa`, che arriva
          //  dal controllo stesso — leggerla dalla frase avrebbe legato il
          //  codice di risposta alle parole del messaggio, che si riscrivono.
          return json({ ok: false, reason: esito.motivo }, esito.causa === "tipo" ? 415 : 413);
        }

        const tetto = await tettoDelBucket();
        const peso = Number(b.peso) || 0;
        if (peso > 0 && tetto > 0 && peso > tetto) {
          return json(
            {
              ok: false,
              reason: `Il file pesa ${mb(peso)} MB e il limite dell'archivio è ${mb(tetto)} MB: alzalo in Supabase → Storage → ${BUCKET} → Settings.`,
            },
            413,
          );
        }

        //  ── IL PERCORSO ────────────────────────────────────────────────────
        //  Sorteggiato, piatto, con la sola estensione. Del nome che il browser
        //  ha mandato (`b.nome`) non si usa NIENTE per costruire l'indirizzo:
        //  serve solo a essere rimandato indietro, così chi disegna può
        //  proporlo come appunto interno nella scheda, dove lo legge solo chi
        //  lavora la pratica. Il perché è in testa al file.
        const path = `${generaCodice()}.${esito.estensione}`;

        const { data, error } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUploadUrl(path);
        if (error || !data?.token) {
          //  Nessun errore muto: il messaggio dello Storage esce così com'è.
          //  È tecnico, ma è l'unica cosa che dice davvero cos'è successo, e
          //  senza di lui resterebbe solo un pulsante che non funziona.
          return json(
            { ok: false, reason: error?.message || "Lo spazio file non ha risposto." },
            500,
          );
        }

        const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
        const url = String(pub?.publicUrl || "");
        if (!url) return json({ ok: false, reason: "Il file non ha ricevuto un indirizzo." }, 500);

        return json({
          ok: true,
          bucket: BUCKET,
          path,
          token: data.token,
          url,
          //  Il tipo lo decide il server, non il browser: è lo stesso valore che
          //  finirà in `kind` sulla voce, e deve venire dal posto che ha appena
          //  controllato il file.
          kind: esito.kind,
          //  Il nome del consulente collegato col PIN, vuoto per chi è entrato
          //  con l'account padrone. Serve a scrivere `caricatoDa` sulla voce
          //  senza che il browser se lo inventi — quel campo si legge («questa
          //  l'ha messa Marco»), non decide niente.
          caricatoDa: g.chi.tipo === "consulente" ? g.chi.nome : "",
        });
      },
    },
  },
});
