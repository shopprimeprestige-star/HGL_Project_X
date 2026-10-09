/** ── CANCELLARE DAVVERO UNA FOTO DI UN CLIENTE ─────────────────────────────
 *
 *  ── PERCHÉ ESISTE QUESTA ROTTA ────────────────────────────────────────────
 *  Fino a ieri «elimina» sul portafoglio di un cliente toglieva la voce dalla
 *  scheda e basta: il file restava nello spazio del centro, a un indirizzo
 *  PUBBLICO che si apre senza credenziali, per sempre. Chi quel link ce
 *  l'aveva già — un messaggio inoltrato, una scheda lasciata aperta, la
 *  cronologia di un browser — continuava a vedere la foto anche dopo. Sono
 *  foto di teste, di prima e dopo, a volte di volti: un dato personale che
 *  sopravviveva alla propria cancellazione, mentre chi premeva il pulsante
 *  credeva il contrario. Il messaggio lo diceva, ed era onesto, ma dire la
 *  verità su un difetto non è ripararlo.
 *
 *  ── LA CONSEGUENZA, DICHIARATA ────────────────────────────────────────────
 *  Da qui «elimina» è IRREVERSIBILE, e infatti il pulsante non offre più
 *  «Annulla»: rimetterebbe in elenco una voce che punta a un file che non
 *  esiste più, cioè un riquadro rotto al posto di una foto. È il prezzo
 *  giusto — su un dato personale, «tolto dalla vista» e «cancellato» non
 *  possono essere la stessa parola.
 *
 *  ── IL PERCORSO SI RICAVA DALL'INDIRIZZO, E SI CONTROLLA ─────────────────
 *  Il browser manda l'url pubblico della voce che sta togliendo, non un
 *  percorso libero: da quell'url si estrae il nome del file e si accetta solo
 *  se è un nome che questo sistema può aver generato (vedi `PERCORSO_BUONO`).
 *  ⚠️ Senza quel controllo questa rotta sarebbe un «cancella il file che ti
 *   dico» per chiunque abbia una sessione CRM: basterebbe passare un percorso
 *   con dei ../ per uscire dalla cartella. I nomi che generiamo sono un codice
 *   e un'estensione, niente altro, quindi il filtro può essere severo.
 *
 *  ── LA GUARDIA È QUELLA DELLE POSE ────────────────────────────────────────
 *  `guardiaCRM(..., "installazioni")`: è lo stesso permesso con cui la foto è
 *  stata caricata (api.crm.media-upload). Chi può metterla può toglierla, e
 *  chi non può fare le pose non tocca le foto dei clienti. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { guardiaCRM } from "./api.crm.accesso";

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

/** Lo stesso bucket del caricamento, scritto qui e non importato per la stessa
 *  ragione per cui è scritto lì: sono due rotte del server, e una costante
 *  condivisa fra loro passerebbe da un file che il browser importa. */
const BUCKET = "clienti-media";

/** ── COSA PUÒ ESSERE UN PERCORSO NOSTRO ───────────────────────────────────
 *  `api.crm.media-upload` scrive `${generaCodice()}.${estensione}`: caratteri
 *  di un codice, un punto, un'estensione corta. Niente cartelle, niente punti
 *  doppi, niente barre. Tutto ciò che non ha questa forma non l'abbiamo
 *  generato noi e non si cancella. */
const PERCORSO_BUONO = /^[A-Za-z0-9_-]{6,64}\.[A-Za-z0-9]{2,5}$/;

/** Dall'url pubblico al nome del file. Si prende l'ultimo pezzo del percorso e
 *  si buttano via query e frammento: gli indirizzi dello Storage a volte si
 *  portano dietro un `?t=` per forzare il ricarico, e quel pezzo non fa parte
 *  del nome. Torna stringa vuota quando non si riesce a leggere niente di
 *  sensato — meglio non cancellare che cancellare a caso. */
function percorsoDa(url: string): string {
  try {
    const u = new URL(url);
    const ultimo = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? "");
    return PERCORSO_BUONO.test(ultimo) ? ultimo : "";
  } catch {
    return "";
  }
}

export const Route = createFileRoute("/api/crm/media-elimina")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "installazioni");
        if (!g.ok) return g.risposta;

        let b: { url?: unknown } = {};
        try {
          const grezzo = await request.json();
          if (grezzo && typeof grezzo === "object") b = grezzo as typeof b;
        } catch {
          return json({ ok: false, reason: "Richiesta illeggibile: riprova." }, 400);
        }

        const percorso = percorsoDa(typeof b.url === "string" ? b.url : "");
        if (!percorso) {
          return json(
            {
              ok: false,
              reason: "Questo file non risulta caricato da qui: non è stato cancellato niente.",
            },
            400,
          );
        }

        const { error } = await supabaseAdmin.storage.from(BUCKET).remove([percorso]);
        if (error) {
          //  Il messaggio dello Storage esce così com'è: è tecnico, ma è
          //  l'unica cosa che dice davvero cos'è successo. Senza, resterebbe
          //  un pulsante che non funziona e nessuno saprebbe perché.
          return json({ ok: false, reason: error.message }, 500);
        }

        //  ⚠️ SI RISPONDE BENE ANCHE SE IL FILE NON C'ERA. Lo Storage non
        //   distingue «cancellato» da «non esisteva», e va bene così: chi
        //   preme due volte, o toglie una voce il cui file era già sparito,
        //   deve vedere la scheda aggiornarsi lo stesso. L'esito che conta per
        //   il cliente è «quel file non è più raggiungibile», e in entrambi i
        //   casi è vero.
        return json({ ok: true });
      },
    },
  },
});
