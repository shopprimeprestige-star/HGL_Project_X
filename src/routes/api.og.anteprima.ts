/** L'IMMAGINE che i programmi di messaggistica vanno a prendere.
 *  GET  /api/og/anteprima?tipo=invito|preventivo&c=CODICE
 *  HEAD stesso indirizzo — e non è un dettaglio: vedi più sotto.
 *
 *  ── PERCHÉ UN INDIRIZZO FISSO E NON QUELLO DEL DEPOSITO ───────────────────
 *  Nella pagina l'indirizzo dell'anteprima deve essere scritto PRIMA che
 *  l'anteprima esista: il consulente crea il link, e solo un istante dopo il
 *  browser finisce di disegnare e deposita l'immagine. Se nella pagina ci fosse
 *  l'indirizzo del deposito, il link creato e mandato in fretta porterebbe
 *  un'immagine che ancora non c'è — cioè un riquadro rotto, per sempre, perché
 *  i lettori di anteprime tengono in cache anche i fallimenti.
 *  Questo indirizzo invece decide al momento della richiesta: se l'anteprima
 *  personale c'è, la consegna; se non c'è ancora, consegna il marchio dello
 *  studio. Nel peggiore dei casi si vede il logo — mai un buco.
 *
 *  ── PERCHÉ ESISTE ANCHE UN GESTORE «HEAD» ─────────────────────────────────
 *  ⚠️ Era il difetto vero, ed è rimasto invisibile per cinque tentativi.
 *  Un lettore di anteprime non scarica un'immagine alla cieca: prima chiede
 *  solo le intestazioni (HEAD) per sapere CHE COSA sta per prendere e quanto
 *  pesa. Questa rotta dichiarava soltanto GET: una richiesta HEAD non trovava
 *  nessuno e finiva sull'applicazione, che rispondeva con la propria pagina,
 *  cioè `text/html`. Da lì il lettore concludeva che quell'indirizzo non è
 *  un'immagine e rinunciava — senza errori, senza tracce, con un riquadro
 *  vuoto. E chiedendo la stessa cosa in GET l'immagine arrivava benissimo: è il
 *  motivo per cui ogni verifica fatta a mano diceva che funzionava tutto.
 *
 *  ── PERCHÉ I BYTE SI LEGGONO IN MEMORIA ───────────────────────────────────
 *  ⚠️ Far scorrere il flusso del deposito non permette di dichiarare
 *  `Content-Length`, e senza quella riga il lettore non sa quanto pesa
 *  l'immagine prima di scaricarla: alcuni rinunciano. Centoventi chilobyte in
 *  memoria su un Worker non sono un problema; un'anteprima che non compare sì.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { anteprimaDepositata, urlAnteprima, type TipoAnteprima } from "./api.anteprima";
import { DURATA_BREVE_S, quantoDuraImmagine } from "@/shop/anteprima-quanto-dura";
import { spezzaCodiceAnteprima } from "@/shop/chi-dal-link";
import { attesoDalGettone, chiaveAttesi, consulenzaDiGruppo, leggiAttesi } from "@/crm/fascia-consulenza";
import { chiaveInvitoDiLead } from "@/crm/invito";

/** ── IL RIPIEGO NON PUÒ ESSERE IL LOGO ────────────────────────────────────
 *  ⚠️ Qui c'era il logo dello studio, e prima ancora una figura presa da un
 *  altro servizio. Era il difetto che si vedeva a schermo come «riquadro
 *  bianco»: il logo è un PNG 2048×484 CON TRASPARENZA, mentre la pagina
 *  dichiara al lettore `image/jpeg`, 1200×675. Tre smentite in faccia —
 *  formato, proporzioni, trasparenza — e il lettore, invece di adattarsi,
 *  scarta la scheda intera. Il ripiego serve a proteggere l'anteprima: se
 *  contraddice ciò che la pagina promette, la rompe ogni volta che scatta.
 *
 *  Adesso è un JPEG 1200×675 opaco, servito da casa nostra, con lo stesso
 *  impianto grafico del biglietto: chi lo riceve vede una scheda di marca, non
 *  un rettangolo vuoto. Nessuna informazione personale, perché scatta proprio
 *  quando la persona non la conosciamo. */
//  ⚠️ Sta nel deposito esterno e NON su questo stesso sito, per un motivo che
//  costa un rilascio a scoprirlo: un Worker che chiede un'immagine al proprio
//  indirizzo fa una richiesta a se stesso, e Cloudflare la rifiuta — il ripiego
//  non arrivava mai e si finiva sul rimando, cioè di nuovo sul comportamento
//  che stavamo togliendo. Il file sorgente resta in public/ come copia
//  leggibile, ma quello servito è questo.
const RIPIEGO = "https://jrezhxbuetpfhvsrkrwo.supabase.co/storage/v1/object/public/anteprime/_predefinita.jpg";

/** ⚠️ Le intestazioni stanno in un posto solo perché GET e HEAD DEVONO dire la
 *  stessa identica cosa. Due gestori che si contraddicono sul tipo del
 *  contenuto sono esattamente il genere di errore che nessuno va a cercare.
 *
 *  ── QUANTO SI PUÒ TENERE ─────────────────────────────────────────────────
 *  Qui c'erano cinque minuti per tutti, e sono la causa della segnalazione
 *  «dopo 24 ore l'anteprima si toglie dal messaggio»: chi disegna l'anteprima
 *  la tiene per il tempo che diciamo noi, e cinque minuti vogliono dire che
 *  ogni volta che il messaggio si ridisegna bisogna tornare a chiedere. Basta
 *  una richiesta andata storta — la rete del telefono, il tetto giornaliero,
 *  una risposta lenta — e il messaggio resta un link nudo per sempre.
 *  Adesso i cinque minuti valgono solo finché l'anteprima può ancora cambiare
 *  (la ristampa del biglietto, che succede entro pochi minuti): dopo si tiene
 *  trenta giorni. La regola, con la misura, sta in shop/anteprima-quanto-dura.
 *
 *  ⚠️ CON LA CACHE LUNGA SERVE POTER DIRE «È LA STESSA». `Last-Modified` ed
 *   `ETag` costano due righe e fanno risparmiare l'intera immagine a chi
 *   ricontrolla: senza, ogni controllo sarebbe uno scaricamento. */
const intestazioniImmagine = (
  tipo: string,
  byte: number,
  durata: number,
  marchio: string,
  quando: number,
): Record<string, string> => ({
  "Content-Type": tipo,
  "Content-Length": String(byte),
  "Cache-Control": `public, max-age=${durata}`,
  ETag: marchio,
  ...(quando ? { "Last-Modified": new Date(quando).toUTCString() } : {}),
});

/** Chi ricontrolla si accontenta di un «è la stessa», se lo è davvero. */
function nonCambiata(richiesta: Request | null | undefined, marchio: string, quando: number): boolean {
  if (!richiesta) return false;
  const seNon = richiesta.headers.get("if-none-match");
  if (seNon && seNon.split(",").some((x) => x.trim() === marchio)) return true;
  const daQuando = richiesta.headers.get("if-modified-since");
  if (daQuando && quando) {
    const t = Date.parse(daQuando);
    //  Al secondo: `Last-Modified` non porta i millesimi, e confrontarli
    //  farebbe risultare «cambiata» un'immagine identica a ogni controllo.
    if (Number.isFinite(t) && Math.floor(quando / 1000) * 1000 <= t) return true;
  }
  return false;
}

/** Il valore di una riga di `app_config`, o stringa vuota. */
async function valoreConfig(chiave: string): Promise<string> {
  if (!chiave) return "";
  try {
    const { data } = await supabaseAdmin
      .from("app_config")
      .select("value")
      .eq("key", chiave)
      .maybeSingle();
    return String((data as { value?: string } | null)?.value || "").trim();
  } catch {
    return "";
  }
}

/** Le tre forme sotto cui può stare depositato un codice d'invito: scritto
 *  tale e quale, senza trattini, raggruppato a quattro. Una sola avrebbe
 *  funzionato a metà — il modo peggiore di funzionare. */
function formeDelCodice(grezzo: string): string[] {
  const senzaTrattini = grezzo.replace(/-/g, "");
  const raggruppato =
    senzaTrattini.length === 12 ? senzaTrattini.replace(/(.{4})(.{4})(.{4})/, "$1-$2-$3") : "";
  return [grezzo, senzaTrattini, raggruppato].filter(Boolean);
}

/** ── IL BIGLIETTO DI CHI HA RICEVUTO QUESTO LINK ───────────────────────────
 *  Segnalazione del committente: «ora l'anteprima mostra il nome del primo che
 *  ho assegnato a quell'orario, invece deve mostrare il nome corretto a ogni
 *  persona sul suo link».
 *
 *  Il link porta il gettone di chi lo riceve (`?chi=`, vedi shop/chi-dal-link),
 *  e da quel gettone si risale alla persona: l'elenco degli attesi della stanza
 *  (`attesi:<codice>`) dice chi sono e in che ordine, e il gettone è l'impronta
 *  della scheda. Dalla scheda si arriva alla sua pagina d'invito, e sotto quel
 *  codice c'è il biglietto col SUO nome.
 *
 *  ⚠️ `inGruppo` non è un dettaglio: è la riga che impedisce il guasto
 *   peggiore. Se in quella stanza si aspetta più di una persona e il biglietto
 *   personale non si trova, NON si ripiega sul biglietto depositato sotto la
 *   stanza — perché quello porta il nome di un altro cliente, e mandare a
 *   qualcuno il nome di chi sta valutando un trapianto è peggio di mandargli
 *   il marchio dello studio. */
async function anteprimaDiChi(
  stanza: string,
  gettone: string,
): Promise<{ url: string; inGruppo: boolean }> {
  try {
    const attesi = leggiAttesi(await valoreConfig(chiaveAttesi(stanza)));
    const inGruppo = consulenzaDiGruppo(attesi);
    const chi = attesoDalGettone(attesi, gettone);
    if (!chi) return { url: "", inGruppo };
    const invito = await valoreConfig(chiaveInvitoDiLead(chi.leadId));
    if (!invito) return { url: "", inGruppo };
    for (const forma of formeDelCodice(invito)) {
      const url = await urlAnteprima("invito", forma);
      if (url) return { url, inGruppo };
    }
    return { url: "", inGruppo };
  } catch {
    //  Una lettura andata storta non deve diventare «è di un altro»: si
    //  risponde come se il gettone non ci fosse, cioè col comportamento di
    //  prima.
    return { url: "", inGruppo: false };
  }
}

/** ── DALLA STANZA ALL'INVITO, SENZA CHE NESSUNO PREMA NIENTE ───────────────
 *  Il cliente riceve due link diversi per lo stesso appuntamento: la pagina
 *  (/invito/CODICE) e la stanza (/meetly/CODICE). Sono due codici scollegati,
 *  quindi l'anteprima depositata sotto l'uno non si trova sotto l'altro — ed è
 *  per questo che la stanza mostrava la scheda generica mentre la pagina
 *  mostrava il biglietto della persona.
 *
 *  Depositarla due volte risolve solo da qui in avanti. Questa strada invece
 *  vale anche per tutti gli inviti già creati: se per la stanza non c'è niente,
 *  si risale — stanza → lead → invito — e si serve il biglietto di quel lead.
 *
 *  ⚠️ Il codice dell'invito è salvato SENZA trattini (A3AKX6DVRTDN) mentre
 *  nell'indirizzo è raggruppato a quattro (A3AK-X6DV-RTDN), e l'anteprima può
 *  essere stata depositata sotto l'una o l'altra forma a seconda di chi l'ha
 *  creata. Si provano tutte e due: una sola avrebbe funzionato a metà, che è il
 *  modo peggiore di funzionare — sembra un caso, e non si trova mai il perché. */
async function anteprimaDellaStanza(codiceStanza: string): Promise<string> {
  try {
    //  Chi è il lead di questa stanza: la sessione porta il codice dentro il
    //  proprio JSON, e la chiave contiene l'identificativo del lead.
    const { data } = await supabaseAdmin
      .from("app_config")
      .select("key")
      .like("key", "meet:%")
      .like("value", `%"code":"${codiceStanza}"%`)
      .limit(1);
    const chiave = (data as { key?: string }[] | null)?.[0]?.key || "";
    const leadId = chiave.replace(/^meet:/, "").trim();
    if (!leadId) return "";

    const { data: inv } = await supabaseAdmin
      .from("app_config")
      .select("value")
      .eq("key", `invitoDi:${leadId}`)
      .maybeSingle();
    const grezzo = String((inv as { value?: string } | null)?.value || "").trim();
    if (!grezzo) return "";

    const senzaTrattini = grezzo.replace(/-/g, "");
    const raggruppato =
      senzaTrattini.length === 12 ? senzaTrattini.replace(/(.{4})(.{4})(.{4})/, "$1-$2-$3") : "";
    for (const forma of [grezzo, senzaTrattini, raggruppato].filter(Boolean)) {
      const url = await urlAnteprima("invito", forma);
      if (url) return url;
    }
    return "";
  } catch {
    return "";
  }
}

async function servi(request: Request, soloIntestazioni: boolean): Promise<Response> {
  const u = new URL(request.url);
  const grezzo = u.searchParams.get("tipo");
  const tipo: TipoAnteprima | null = grezzo === "invito" || grezzo === "preventivo" ? grezzo : null;
  const codice = String(u.searchParams.get("c") || "").trim();
  return serviAnteprima(tipo, codice, soloIntestazioni, request);
}

/** Il cuore, condiviso con la forma «a percorso» (…/invito/CODICE.jpg): due
 *  indirizzi per la stessa immagine, una sola idea di come si serve. */
export async function serviAnteprima(
  tipo: TipoAnteprima | null,
  codice: string,
  soloIntestazioni: boolean,
  richiesta?: Request | null,
): Promise<Response> {
  //  ⚠️ Una richiesta malformata NON riceve più un'immagine.
  //  Rispondere 200 col ripiego a chiunque chieda qualunque cosa ha un costo
  //  che si paga dopo: ogni verifica sembra riuscita, anche quella fatta con
  //  un indirizzo storto, e la diagnosi mente esattamente come mentiva il
  //  gestore HEAD mancante. Se manca il tipo o il codice, è un errore: si dice.
  if (!tipo || !codice) {
    return new Response("anteprima: indirizzo incompleto", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  /*  ── UN BIGLIETTO PER CIASCUNO ────────────────────────────────────────
      Il codice può portare in coda chi ha ricevuto il link
      (`jqj-ypdd-pzt_pb4b5c685`): in quel caso il biglietto da servire è il
      suo, non quello della stanza. Senza coda è il codice di sempre, e tutto
      si comporta come prima. */
  const { codice: base, gettone } = spezzaCodiceAnteprima(codice);

  //  Il deposito sotto il codice chiesto: con la coda è il biglietto personale,
  //  senza coda è quello della stanza (o della pagina d'invito).
  const deposito = await anteprimaDepositata(tipo, codice);
  let personale = deposito.url;
  let quando = deposito.quando;

  /*  ⚠️ `soloSuo` dice: in questa stanza si aspetta più di una persona, e il
      biglietto di CHI HA QUESTO LINK non c'è. Allora si va di marchio dello
      studio e si smette di cercare: il biglietto depositato sotto la stanza
      porta il nome di un altro cliente, ed è esattamente il guasto segnalato. */
  let soloSuo = false;
  if (!personale && gettone && tipo === "invito") {
    const suo = await anteprimaDiChi(base, gettone);
    if (suo.url) {
      personale = suo.url;
      quando = 0;
    } else {
      soloSuo = suo.inGruppo;
    }
  }

  //  Niente sotto questo codice: se è una stanza, si risale al suo invito.
  if (!personale && !soloSuo) {
    if (gettone) {
      const dellaStanza = await anteprimaDepositata(tipo, base);
      personale = dellaStanza.url;
      quando = dellaStanza.quando;
    }
    if (!personale && tipo === "invito") {
      personale = await anteprimaDellaStanza(base);
      quando = 0;
    }
  }
  const destinazione = personale || RIPIEGO;
  /*  ⚠️ IL RIPIEGO RESTA A CACHE CORTA. Scatta quando l'anteprima personale
      non è ancora stata depositata — cioè in un momento che dura pochi secondi
      — e tenerlo trenta giorni vorrebbe dire che il primo che apre il link
      decide per tutti gli altri che l'anteprima era il marchio. */
  const durata = personale ? quantoDuraImmagine({ depositataIl: quando }) : DURATA_BREVE_S;
  const marchio = personale ? `W/"${tipo}-${codice}-${quando}"` : 'W/"ripiego"';
  if (nonCambiata(richiesta, marchio, quando)) {
    return new Response(null, {
      status: 304,
      headers: {
        "Cache-Control": `public, max-age=${durata}`,
        ETag: marchio,
        ...(quando ? { "Last-Modified": new Date(quando).toUTCString() } : {}),
      },
    });
  }

  try {
    const presa = await fetch(destinazione, { cf: { cacheTtl: 300 } } as RequestInit);
    if (presa.ok) {
      const byte = await presa.arrayBuffer();
      //  ⚠️ Il tipo si riconosce dai BYTE, non si copia dall'origine: un
      //  indirizzo che finisce in .jpg può ricevere dal deposito un PNG, e
      //  annunciarlo come tale smentisce ciò che la pagina ha promesso. I due
      //  primi byte bastano: FF D8 è JPEG, 89 50 è PNG.
      const testa = new Uint8Array(byte.slice(0, 2));
      const tipoVero =
        testa[0] === 0xff && testa[1] === 0xd8
          ? "image/jpeg"
          : testa[0] === 0x89 && testa[1] === 0x50
            ? "image/png"
            : "";
      if (!tipoVero) throw new Error("il deposito non ha restituito un'immagine");
      return new Response(soloIntestazioni ? null : byte, {
        status: 200,
        headers: intestazioniImmagine(tipoVero, byte.byteLength, durata, marchio, quando),
      });
    }
  } catch {
    //  Deposito irraggiungibile: meglio un rimando che niente.
  }

  return new Response(null, {
    status: 302,
    //  ⚠️ Il rimando NON si tiene a lungo: è il segno che qualcosa non ha
    //   funzionato (il deposito non ha risposto), e un errore tenuto trenta
    //   giorni è un'anteprima rotta per trenta giorni.
    headers: { Location: destinazione, "Cache-Control": `public, max-age=${DURATA_BREVE_S}` },
  });
}

export const Route = createFileRoute("/api/og/anteprima")({
  server: {
    handlers: {
      HEAD: async ({ request }) => servi(request, true),
      GET: async ({ request }) => servi(request, false),
    },
  },
});
