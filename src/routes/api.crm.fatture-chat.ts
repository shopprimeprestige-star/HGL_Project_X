/** ── FATTURE DALLA CHAT · LA ROTTA (api.crm.fatture-chat.ts) ─────────────────
 *  Commessa 2026-11-13-fatture-dalla-chat, T5 (PIANO §3, §4). Una rotta
 *  sottile: guardia + smistamento. La logica sta in `chat.server.ts` (porte
 *  iniettate, provata); qui c'è solo il collegamento a Supabase, allo Storage
 *  e all'AI già in uso — stesso schema di `api.crm.fatture-bulk.ts`.
 *
 *  GET                                            → elenco dei lotti aperti
 *  GET ?candidati=1[&q=ricerca]                    → clienti pronti (passo 1)
 *  GET ?lotto=ID                                   → testata + righe
 *  GET ?lotto=ID&miniatura=pagamento&idRiga=…      → indirizzo firmato (60 s)
 *  POST { azione, … }  → crea, aggiungi-cliente, cerca-chat, carica-pagamento,
 *                         leggi-pagamento, rileggi-chat, salva-riga,
 *                         prendi-controllo, annulla, pulisci
 *
 *  ⚠️ Un GET non cancella mai niente. ⚠️ Nessuna intestazione CORS (stessa
 *   origine). ⚠️ Nei log solo codici. ⚠️ Permesso «pagamenti» su OGNI
 *   chiamata, miniature comprese: sono tessere sanitarie e bonifici.
 *  ⚠️ Il bonifico va nel bucket PRIVATO `dati-fattura` (solo chiave di
 *   servizio), percorso `<utente>/chat/<lotto>/<uuid>.jpg`: nessun nome di
 *   persona. Le immagini della chat (tessera/indirizzo) non toccano MAI
 *   questo bucket: si leggono e si scartano (`porteRaccoltaChatVere`).
 *
 *  ── `emetti-riga`: ORA VA A `emissione-chat.server.ts` (T6) ───────────────
 *  Unica riga cambiata da T6 in questo file (oltre a leggere il CF della
 *  scheda, che l'emissione usa per `cfDiversoDellaScheda` e che T5 non
 *  leggeva mai): il resto della rotta non cambia. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BUCKET_DATI_FATTURA } from "@/crm/fatture/dati-fattura.server";
import { archivioProtettoSu } from "@/crm/fatture/bulk/emissione-bulk";
import { portaLucchettoSu } from "@/crm/fatture/bulk/lucchetto.server";
import {
  chiamaOpenRouterChat,
  gestisciGETChat,
  gestisciPOSTChat,
  porteRaccoltaChatVere,
  type DipendenzeRottaChat,
  type PorteChat,
  type SchedaChatRiga,
} from "@/crm/fatture/dalla-chat/chat.server";
import { emettiRigaChat } from "@/crm/fatture/dalla-chat/emissione-chat.server";
import { schedaIdValido } from "@/crm/fatture/dalla-chat/chiavi";
import type { PaymentInfo } from "@/crm/types";
import { guardiaCRM } from "./api.crm.accesso";
import { leggiConfigAI } from "./api.crm.ai";

const storage = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabaseAdmin as unknown as { storage: any }).storage.from(BUCKET_DATI_FATTURA);
const storagePonte = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabaseAdmin as unknown as { storage: any }).storage.from("ponte-media");

/** Dal data URL ai byte (atob a pezzi: il file è un solo screenshot, ~1 MB). */
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

/** Una riga di `crm_leads` → `SchedaChatRiga`: nome/cognome/telefono/`payment` per intero
 *  (a differenza di `schedaDaLead` della bulk, qui serve anche il pagamento e il telefono
 *  COMPLETO — `raccogliChat` ne ricava da sé le ultime 9 cifre). */
function schedaChatDaRiga(r: Record<string, unknown>): SchedaChatRiga {
  let payment: SchedaChatRiga["payment"] = null;
  const grezzo = r.payment;
  if (grezzo && typeof grezzo === "object" && !Array.isArray(grezzo)) {
    const p = grezzo as {
      accontoPagato?: unknown;
      statoPagamento?: unknown;
      dataPagamento?: unknown;
    };
    payment = {
      ...(typeof p.accontoPagato === "number" ? { accontoPagato: p.accontoPagato } : {}),
      ...(typeof p.statoPagamento === "string"
        ? { statoPagamento: p.statoPagamento as PaymentInfo["statoPagamento"] }
        : {}),
      ...(typeof p.dataPagamento === "string" ? { dataPagamento: p.dataPagamento } : {}),
    };
  }
  return {
    id: String(r.id ?? ""),
    nome: String(r.nome ?? ""),
    cognome: String(r.cognome ?? ""),
    telefono: String(r.telefono ?? ""),
    payment,
    //  Il CF già scritto a mano sulla scheda (T6, `cfDiversoDellaScheda` in emissione).
    codiceFiscale: String(r.codiceFiscale ?? ""),
  };
}

function porteVere(utente: string): PorteChat {
  const crm = supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        eq: (
          k: string,
          v: string,
        ) => {
          eq: (
            k2: string,
            v2: string,
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
            maybeSingle: () => PromiseLike<{
              data: Record<string, unknown> | null;
              error: { message: string } | null;
            }>;
          };
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

  return {
    archivio: archivioProtettoSu(supabaseAdmin),
    lucchetto: portaLucchettoSu(supabaseAdmin),
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
    raccolta: porteRaccoltaChatVere(supabaseAdmin, {
      // Senza `secondi`: 60 (basta a scaricarla subito per l'AI, T4). Con `secondi` (la miniatura,
      // T11.1, `FIRMA_LETTURA_S` = 300): quell'indirizzo lo usa il browser, non il server.
      firmaPonte: async (percorso, secondi) => {
        const { data } = await storagePonte().createSignedUrl(percorso, secondi ?? 60);
        return (data?.signedUrl as string | undefined) ?? null;
      },
      fetch,
    }),
    ai: async (corpo, timeoutMs) => {
      const cfg = await leggiConfigAI();
      if (!cfg.pronto)
        return {
          errore: "interno",
          messaggio: "Manca la chiave dell'intelligenza artificiale: si mette da Impostazioni.",
        };
      return chiamaOpenRouterChat({ fetch, chiave: cfg.apiKey, corpo, timeoutMs });
    },
    adesso: () => Date.now(),
    id: () => crypto.randomUUID(),
    //  ⚠️ Solo codici: mai id, nomi, percorsi o testi.
    log: (codice) => console.warn(`[fatture-chat] ${codice}`),
    utente,
    //  Tutte le schede del titolare (passo 1, candidati + ricerca manuale), a pagine di 1000 per id.
    schede: async () => {
      const tutte: SchedaChatRiga[] = [];
      for (let da = 0; ; da += 1000) {
        const { data, error } = await crm
          .from("crm_leads")
          .select(
            "id,nome:data->>nome,cognome:data->>cognome,telefono:data->>telefono,payment:data->payment,codiceFiscale:data->>codiceFiscale",
          )
          .eq("user_id", utente)
          .order("id")
          .range(da, da + 999);
        //  ⚠️ Un elenco a metà non deve somigliare a «tutte»: la ricerca manuale su una scheda mancante si bloccherebbe.
        if (error) throw new Error(error.message);
        const blocco = data ?? [];
        for (const r of blocco) tutte.push(schedaChatDaRiga(r));
        if (blocco.length < 1000) return tutte;
      }
    },
    //  Una sola scheda (1 sottorichiesta): `aggiungi-cliente`/`cerca-chat`.
    scheda: async (id) => {
      if (!schedaIdValido(id)) return null;
      const { data, error } = await crm
        .from("crm_leads")
        .select(
          "id,nome:data->>nome,cognome:data->>cognome,telefono:data->>telefono,payment:data->payment,codiceFiscale:data->>codiceFiscale",
        )
        .eq("user_id", utente)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? schedaChatDaRiga(data) : null;
    },
  };
}

const dipendenze: DipendenzeRottaChat = {
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
  emettiRiga: emettiRigaChat,
};

export const Route = createFileRoute("/api/crm/fatture-chat")({
  server: {
    handlers: {
      GET: ({ request }) => gestisciGETChat(request, dipendenze),
      POST: ({ request }) => gestisciPOSTChat(request, dipendenze),
    },
  },
});
