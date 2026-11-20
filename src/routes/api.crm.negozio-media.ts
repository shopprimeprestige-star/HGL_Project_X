/** ── I PERMESSI DI CARICAMENTO DEL CMS: LA ROTTA (api.crm.negozio-media.ts) ──
 *  Commessa 2026-11-20-shop-completo (T10). POST { tipo: "foto" | "video" | "copertina", mime, peso }
 *  → { ok, bucket: "shop-media", path, token, url }: un permesso FIRMATO per caricare UN file. Tutto il lavoro (mime, peso,
 *  percorso sorteggiato) è in `src/crm/negozio/media.server.ts`; qui si collegano la guardia e lo Storage.
 *
 *  ⚠️ Permesso «pagamenti» su ogni chiamata (la guardia è la prima cosa del modulo). Solo permessi di CARICAMENTO: nessuna
 *   lettura firmata, nessun accesso al database. Nessuna intestazione CORS. Nei log solo codici (mai il token). */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { gestisciPOST, type PorteMedia } from "@/crm/negozio/media.server";
import { guardiaCRM } from "./api.crm.accesso";

const dipendenze: PorteMedia = {
  guardia: async (request) => {
    const g = await guardiaCRM(request, {}, "pagamenti", { extra: { prodotti: [] } });
    return g.ok ? { ok: true, nome: g.chi.nome } : g;
  },
  adesso: () => new Date(),
  log: (codice) => console.warn(`[negozio-media] ${codice}`),
  storage: {
    creaPermesso: async (bucket, path) => {
      //  senza opzioni: niente `upsert`, quindi un file che esiste già non si sovrascrive mai
      const r = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path);
      //  il modulo scrive nel log un codice fisso e risponde 500: il messaggio dello Storage non esce
      if (r.error || !r.data) throw new Error("permesso");
      return { token: r.data.token, url: r.data.signedUrl };
    },
  },
};

export const Route = createFileRoute("/api/crm/negozio-media")({
  server: {
    handlers: {
      POST: ({ request }) => gestisciPOST(request, dipendenze),
    },
  },
});
