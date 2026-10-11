/** RACCOLTE MEDIA — IL LATO CHE SCRIVE (solo presentatore) ──────────────────
 *  POST { voci:[{url,kind,nome}], titolo? }  -> crea una raccolta, restituisce
 *                                               codice e link pronto da mandare
 *  GET                                       -> elenco delle raccolte create
 *  DELETE ?codice=...                        -> ritira un link
 *
 *  La LETTURA pubblica NON sta qui: sta in /api/public/galleria, che sa fare
 *  una cosa sola — restituire le voci della raccolta di cui si conosce il
 *  codice. È una separazione fisica, non una gentilezza: finché l'elenco di
 *  tutte le raccolte e la lettura col codice vivono in due rotte diverse,
 *  nessun parametro dimenticato può trasformare la seconda nella prima.
 *
 *  ── UNA RIGA PER RACCOLTA, NON UN ELENCO UNICO ─────────────────────────────
 *  Le altre impostazioni salvano un array intero sotto una chiave sola. Qui no,
 *  per due motivi:
 *   · leggere una raccolta è la richiesta che fa il CLIENTE, dal telefono, ed è
 *     una lettura per chiave — non deve scaricare (né poter scaricare) tutte le
 *     raccolte di tutti gli altri clienti per poi cercarci dentro la sua;
 *   · creare un link è un `upsert` su una chiave nuova. Con l'elenco unico
 *     sarebbe leggi-modifica-riscrivi, e due consulenti che generano un link
 *     nello stesso momento si cancellerebbero il link a vicenda, senza errori.
 */
import { createFileRoute } from "@tanstack/react-router";
import { INTESTAZIONI_CONSENTITE, guardia, guardiaP } from "./api.presenter.consultant";
import { cancellaConfig, elencaConfig, leggiConfig, scriviConfig } from "@/media/config.server";
import {
  MAX_TITOLO,
  MAX_VOCI,
  PREFISSO_GALLERIA,
  chiaveGalleria,
  codicePulito,
  formattaCodice,
  generaCodice,
  normalizzaGalleria,
  normalizzaVoci,
  type Galleria,
} from "@/media/galleria";
import { urlPubblico } from "@/lib/sito";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE,
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** Il link come lo riceve il cliente: dal DOMINIO PUBBLICO, mai dall'indirizzo
 *  da cui è aperta la pagina del consulente (che è quello tecnico del servizio).
 *  Il codice viaggia a gruppi di quattro perché questi link si dettano anche a
 *  voce; chi legge lo ripulisce comunque. */
export const linkGalleria = (codice: string) => urlPubblico(`media/${formattaCodice(codice)}`);

export const Route = createFileRoute("/api/presenter/gallerie")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      // ── ELENCO DELLE RACCOLTE CREATE ────────────────────────────────────
      //  Solo per chi è entrato: qui dentro c'è la chiave di ogni link già
      //  mandato ai clienti. Nessuna voce, solo quante sono: per capire quale
      //  link ritirare non serve rivedere le foto.
      GET: async ({ request }) => {
        const no = await guardia(request, cors, { gallerie: [] });
        if (no) return no;
        const righe = await elencaConfig(PREFISSO_GALLERIA);
        const gallerie = righe
          .map((r) => {
            const codice = codicePulito(r.key.slice(PREFISSO_GALLERIA.length));
            if (!codice) return null;
            let g: Galleria | null = null;
            try {
              g = normalizzaGalleria(JSON.parse(r.value), codice);
            } catch {
              g = null;
            }
            if (!g) return null;
            return {
              codice,
              titolo: g.titolo ?? "",
              quante: g.voci.length,
              creataIl: g.creataIl,
              url: linkGalleria(codice),
            };
          })
          .filter((x): x is NonNullable<typeof x> => !!x)
          // le ultime create per prime: è quello che si sta cercando
          .sort((a, b) => (b.creataIl || "").localeCompare(a.creataIl || ""));
        return json({ ok: true, gallerie });
      },

      // ── CREA UNA RACCOLTA ───────────────────────────────────────────────
      POST: async ({ request }) => {
        const no = await guardiaP(request, cors, "impostazioni");
        if (no) return no;

        let body: { voci?: unknown; titolo?: unknown } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          /* corpo illeggibile = niente voci */
        }

        //  Si ripulisce con le stesse regole della lettura: quello che non
        //  sopravvive qui non sopravviverebbe nemmeno sul telefono del cliente,
        //  e un link che si apre su una raccolta vuota è peggio di un rifiuto.
        const voci = normalizzaVoci(body.voci);
        if (!voci.length) return json({ ok: false, reason: "nessun media selezionato" }, 400);
        if (Array.isArray(body.voci) && body.voci.length > MAX_VOCI) {
          return json({ ok: false, reason: `massimo ${MAX_VOCI} media per link` }, 400);
        }
        const titolo =
          typeof body.titolo === "string" ? body.titolo.trim().slice(0, MAX_TITOLO) : "";

        //  Collisione: con 23^12 combinazioni non succede, ma "non succede" e
        //  "non può succedere" sono due cose diverse — e la conseguenza sarebbe
        //  sovrascrivere il link di un altro cliente. Si controlla e si ripesca.
        let codice = "";
        for (let i = 0; i < 5 && !codice; i++) {
          const c = generaCodice();
          if (!(await leggiConfig(chiaveGalleria(c)))) codice = c;
        }
        if (!codice) return json({ ok: false, reason: "riprova" }, 503);

        const galleria: Galleria = {
          codice,
          ...(titolo ? { titolo } : {}),
          voci,
          creataIl: new Date().toISOString(),
        };
        await scriviConfig(chiaveGalleria(codice), JSON.stringify(galleria));

        return json({ ok: true, codice, url: linkGalleria(codice), quante: voci.length });
      },

      // ── RITIRA UN LINK ──────────────────────────────────────────────────
      //  Cancellare la riga è l'unico modo di far smettere di funzionare un
      //  link già mandato: da lì in poi il cliente vede la schermata gentile.
      DELETE: async ({ request }) => {
        const no = await guardiaP(request, cors, "impostazioni");
        if (no) return no;
        const codice = codicePulito(new URL(request.url).searchParams.get("codice"));
        if (!codice) return json({ ok: false, reason: "codice non valido" }, 400);
        await cancellaConfig(chiaveGalleria(codice));
        return json({ ok: true });
      },
    },
  },
});
