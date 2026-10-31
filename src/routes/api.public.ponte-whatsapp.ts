/** ── IL PONTE WHATSAPP (Baileys), DAL MAC AL CRM ──────────────────────────
 *
 *  POST /api/public/ponte-whatsapp. Lo chiama il servizio sul Mac del
 *  titolare (`strumenti/ponte-whatsapp/`) con i lotti di messaggi e il
 *  battito. Il contratto è il §b del piano (`src/crm/ponte/tipi.ts`); la
 *  logica sta in `crm/ponte/ingresso.ts`, provata. Qui c'è solo il
 *  collegamento.
 *
 *  ⚠️ PUBBLICA: la protegge `X-HGL-Token` contro il segreto `PONTE_WA_TOKEN`
 *   (503 se manca o è più corto di 32 caratteri, 401 se la chiave è
 *   sbagliata, 413 oltre 256 KB, 400 corpo non valido, 500 database). Il
 *   segreto sta solo nei segreti del Worker e in `config.env` sul Mac.
 *  Dal 30/10/2026 la stessa rotta serve anche l'invio a mano dopo le 24 ore:
 *  `tipo` `prendi` ed `esito` (il Mac prende un testo dalla coda e riporta
 *  l'esito) e il battito che risponde `invii_in_attesa`. Con la migrazione
 *  non applicata lotti e battiti vanno come prima (`invii` non lancia mai).
 *  Dal 30/10/2026 serve anche le immagini: `tipo` `media_permesso` ed
 *  `media_fatto` (il Mac chiede il permesso di caricare una foto su Storage e
 *  poi dice «fatto»; i byte non passano dal Worker). Con la migrazione non
 *  applicata rispondono 503 `migrazione` e il Mac trattiene la foto.
 *  Dal 31/10/2026 anche «Mostra» dal segnaposto: `tipo` `media_prendi` (il Mac prende le richieste del
 *  titolare) e `media_esito` (chiude un lavoro richiesto), e il battito risponde `media_v: 2`,
 *  `media_auto` e, se ce ne sono, `media_richieste`. Senza la migrazione i campi si omettono.
 *  Dal 31/10/2026 anche le revoche: `tipo` `revoca` ({ v: 1, tipo, chiave `bw:<cifre>:<id>` }), un
 *  nostro messaggio «eliminato per tutti» dal telefono. Marca la riga come eliminata (mai un DELETE).
 *  ⚠️ L'utente non arriva mai dal corpo: è `manychat_config.user_id`.
 *  ⚠️ Un messaggio vivo nuovo in entrata, senza pari, fa suonare il telefono
 *   del consulente del lead e del titolare (`avvisa`); lo storico mai.
 *  ⚠️ Nei log solo codici e contatori (li scrive `porte.avviso`): mai numeri,
 *   nomi, testi o id.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { gestisciRichiesta } from "@/crm/ponte/ingresso";
import {
  porteIngresso,
  porteInvio,
  porteMedia,
  porteMediaAzioni,
  porteRevoche,
} from "@/crm/ponte/porte.server";
import { avvisaEntratePonte } from "@/crm/push/invio.server";

export const Route = createFileRoute("/api/public/ponte-whatsapp")({
  server: {
    handlers: {
      POST: ({ request }) =>
        gestisciRichiesta(porteIngresso(), {
          request,
          segreto: process.env.PONTE_WA_TOKEN,
          adesso: new Date(),
          invii: porteInvio(),
          //  La notifica sul telefono per i messaggi vivi nuovi (30/10/2026).
          avvisa: avvisaEntratePonte,
          //  Le immagini (30/10/2026): `media_permesso` e `media_fatto`.
          media: porteMedia(),
          //  «Mostra» (31/10/2026): `media_prendi`, `media_esito` e i campi dei media nel battito.
          mediaAzioni: porteMediaAzioni(),
          //  Le revoche (31/10/2026): un nostro messaggio eliminato per tutti dal telefono sparisce dalla chat.
          revoche: porteRevoche(),
        }),
    },
  },
});
