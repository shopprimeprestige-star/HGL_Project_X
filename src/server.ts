/** ── L'INGRESSO DEL SERVIZIO ────────────────────────────────────────────────
 *
 *  Questo file non c'era: l'applicazione usava l'ingresso di serie del
 *  programma quadro, che risponde e basta. Adesso c'è, e fa UNA cosa sola —
 *  dire a chi prepara le anteprime dei link per quanto tempo può tenersele.
 *
 *  Il perché per esteso sta in shop/anteprima-quanto-dura: la pagina rispondeva
 *  «non tenermi» (`no-cache, must-revalidate`), quindi l'anteprima di un
 *  messaggio già mandato si reggeva su una richiesta da rifare ogni volta, e la
 *  prima che andava storta la faceva sparire per sempre dal messaggio.
 *
 *  ⚠️ NON SI TOCCA NIENTE PER UN BROWSER VERO. La regola «gli HTML non si
 *   tengono in cassetto» resta intera: è quella che fa arrivare un
 *   aggiornamento appena pubblicato. Qui si cambia la risposta solo quando chi
 *   chiede è un lettore di anteprime E la pagina è una di quelle che si
 *   mandano (`cacheDellaPagina` decide, e in tutti gli altri casi dice `null`).
 *  ⚠️ NON SI TOCCA IL CORPO DELLA RISPOSTA: si riscrive una sola intestazione,
 *   sulla stessa risposta. Il flusso della pagina passa di qui intatto — è una
 *   pagina servita a pezzi mentre si compone, e ricostruirla la romperebbe.
 *  ⚠️ IL SEGUITO DEVE RESTARE UNA RIGA SOLA. Un ingresso che fa tante cose è
 *   un ingresso che prima o poi ferma tutto il sito: qualunque altra logica va
 *   in una rotta, non qui.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { cacheDellaPagina } from "@/shop/anteprima-quanto-dura";

const rispondi = createStartHandler(defaultStreamHandler);

export default {
  async fetch(request: Request, ...resto: unknown[]): Promise<Response> {
    const risposta = await (rispondi as (r: Request, ...a: unknown[]) => Promise<Response>)(request, ...resto);
    try {
      const quanto = cacheDellaPagina({
        ua: request.headers.get("user-agent"),
        percorso: new URL(request.url).pathname,
        metodo: request.method,
        stato: risposta.status,
        tipoContenuto: risposta.headers.get("content-type"),
      });
      if (quanto) {
        try {
          risposta.headers.set("Cache-Control", quanto);
        } catch {
          /*  ⚠️ Le intestazioni di certe risposte sono sigillate (quelle che
              arrivano da una richiesta fatta altrove). In quel caso si rifà la
              risposta attorno allo STESSO corpo: il flusso resta quello, non
              si legge e non si ricompone niente. */
          const testate = new Headers(risposta.headers);
          testate.set("Cache-Control", quanto);
          return new Response(risposta.body, {
            status: risposta.status,
            statusText: risposta.statusText,
            headers: testate,
          });
        }
      }
    } catch {
      //  ⚠️ Qualunque cosa vada storta qui dentro, la pagina esce lo stesso:
      //   un'anteprima non vale una consulenza che non si apre.
    }
    return risposta;
  },
};
