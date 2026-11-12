/** ── FATTURE DA SCREENSHOT · LA ROTTA (api.crm.fatture-bulk.ts) ─────────────
 *
 *  Una rotta sottile: guardia + smistamento. La logica sta in `bulk.server.ts` (porte iniettate, provata)
 *  e qui c'è solo il collegamento a Supabase, allo Storage e all'AI già in uso.
 *
 *  GET                     → elenco dei lotti aperti
 *  GET ?lotto=ID           → testata, file, decisioni delle righe
 *  GET ?lotto=ID&url=0004,0005 → indirizzi firmati (60 s) per le miniature (massimo 6)
 *  POST { azione, … }      → crea, file, leggi-gruppo, rileggi, salva-riga, emetti-riga,
 *                            prendi-controllo, annulla, pulisci
 *
 *  ⚠️ Un GET non cancella mai niente. ⚠️ Nessuna intestazione CORS (stessa origine, come
 *   `api.crm.documento`). ⚠️ Nei log solo codici. ⚠️ Permesso «pagamenti» su OGNI chiamata, miniature
 *   comprese: sono tessere sanitarie.
 *  ⚠️ La foto va nel bucket PRIVATO `dati-fattura` (solo chiave di servizio), con percorso
 *   `<utente>/bulk/<lotto>/<uuid>.jpg`: nessun nome di persona. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BUCKET_DATI_FATTURA } from "@/crm/fatture/dati-fattura.server";
import { archivioProtettoSu } from "@/crm/fatture/bulk/emissione-bulk";
import { portaLucchettoSu } from "@/crm/fatture/bulk/lucchetto.server";
import { emettiRiga, schedaDaLead } from "@/crm/fatture/bulk/emissione.server";
import {
  archivioSoloBulk,
  chiamaOpenRouter,
  gestisciGET,
  gestisciPOST,
  lucchettoSoloBulk,
  type DipendenzeRotta,
  type PorteBulk,
} from "@/crm/fatture/bulk/bulk.server";
import { guardiaCRM } from "./api.crm.accesso";
import { leggiConfigAI } from "./api.crm.ai";

const storage = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabaseAdmin as unknown as { storage: any }).storage.from(BUCKET_DATI_FATTURA);

/** Dal data URL ai byte (atob a pezzi: i file sono di ~1 MB). */
function inByte(dataUrl: string): Uint8Array {
  const grezzo = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const byte = new Uint8Array(grezzo.length);
  for (let i = 0; i < grezzo.length; i++) byte[i] = grezzo.charCodeAt(i);
  return byte;
}

function inDataUrl(byte: Uint8Array): string {
  let s = "";
  for (let i = 0; i < byte.length; i += 0x8000)
    s += String.fromCharCode(...byte.subarray(i, i + 0x8000));
  return `data:image/jpeg;base64,${btoa(s)}`;
}

function porteVere(utente: string): PorteBulk {
  return {
    archivio: archivioSoloBulk(archivioProtettoSu(supabaseAdmin)),
    lucchetto: lucchettoSoloBulk(portaLucchettoSu(supabaseAdmin)),
    bucket: {
      carica: async (percorso, dataUrl) => {
        const { error } = await storage().upload(percorso, inByte(dataUrl), {
          contentType: "image/jpeg",
          upsert: false,
        });
        return error ? String(error.message ?? "errore") : null;
      },
      scarica: async (percorso) => {
        const { data, error } = await storage().download(percorso);
        if (error || !data) return null;
        return inDataUrl(new Uint8Array(await (data as Blob).arrayBuffer()));
      },
      elenca: async (cartella) => {
        //  Il bucket vuole la cartella senza la barra finale. Fino a 1000 nomi per volta: un lotto ne ha al più 600.
        const { data, error } = await storage().list(cartella.replace(/\/$/, ""), { limit: 1000 });
        if (error || !Array.isArray(data)) return null;
        return (data as { name: string }[]).map((x) => x.name);
      },
      rimuovi: async (percorsi) => {
        const { error } = await storage().remove(percorsi);
        return error ? String(error.message ?? "errore") : null;
      },
      firma: async (percorso, secondi) => {
        const { data } = await storage().createSignedUrl(percorso, secondi);
        return (data?.signedUrl as string | undefined) ?? null;
      },
    },
    ai: async (immagini, timeoutMs) => {
      const cfg = await leggiConfigAI();
      if (!cfg.pronto)
        return {
          errore: "interno",
          messaggio: "Manca la chiave dell'intelligenza artificiale: si mette da Impostazioni.",
        };
      return chiamaOpenRouter({ fetch, chiave: cfg.apiKey, immagini, timeoutMs });
    },
    adesso: () => Date.now(),
    id: () => crypto.randomUUID(),
    //  ⚠️ Solo codici (`"leggi-gruppo occupato"`): mai id, nomi, percorsi o testi.
    log: (codice) => console.warn(`[fatture-bulk] ${codice}`),
    utente,
    //  Tutte le schede del titolare, a pagine di 1000 per id (ogni pagina è una sottorichiesta). Solo i quattro campi
    //  che servono all'abbinamento, estratti dal JSON: né indirizzi né note escono dal database.
    schede: async () => {
      const crm = supabaseAdmin as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            eq: (
              k: string,
              v: string,
            ) => {
              order: (k: string) => {
                range: (
                  da: number,
                  a: number,
                ) => PromiseLike<{
                  data: Record<string, unknown>[] | null;
                  error: { message: string } | null;
                }>;
              };
            };
          };
        };
      };
      const tutte: ReturnType<typeof schedaDaLead>[] = [];
      for (let da = 0; ; da += 1000) {
        const { data, error } = await crm
          .from("crm_leads")
          .select(
            "id,nome:data->>nome,cognome:data->>cognome,codiceFiscale:data->>codiceFiscale,telefono:data->>telefono",
          )
          .eq("user_id", utente)
          .order("id")
          .range(da, da + 999);
        //  ⚠️ Un elenco a metà non deve somigliare a «tutte»: la scelta a mano di una scheda mancante si bloccherebbe.
        if (error) throw new Error(error.message);
        const blocco = data ?? [];
        for (const r of blocco) tutte.push(schedaDaLead(String(r.id), r));
        if (blocco.length < 1000) return tutte;
      }
    },
  };
}

const dipendenze: DipendenzeRotta = {
  guardia: async (request) => {
    //  Nessuna intestazione CORS: `{}`.
    const g = await guardiaCRM(request, {}, "pagamenti");
    if (!g.ok) return g;
    if (!g.chi.adminUserId)
      return {
        ok: false,
        risposta: new Response(
          JSON.stringify({
            ok: false,
            codice: "non_permesso",
            messaggio: "Manca il titolare dei dati.",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          },
        ),
      };
    return { ok: true, utente: g.chi.adminUserId };
  },
  porte: porteVere,
  emettiRiga,
};

export const Route = createFileRoute("/api/crm/fatture-bulk")({
  server: {
    handlers: {
      GET: ({ request }) => gestisciGET(request, dipendenze),
      POST: ({ request }) => gestisciPOST(request, dipendenze),
    },
  },
});
