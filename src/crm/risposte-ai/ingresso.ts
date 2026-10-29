/** ── RISPOSTE AI: LA ROTTA DEL MAC, SENZA DATABASE ───────────────────────────
 *
 *  POST /api/public/risposte-ai la chiama il servizio sul Mac del titolare
 *  (`strumenti/risposte-ai`). La rotta è sottile: passa qui la richiesta, il
 *  segreto e le porte (il database, in `porte.server.ts`). Provata con porte
 *  finte in prove/prove.mjs (proveDelleRisposteAi).
 *
 *  ⚠️ LA CHIAVE È QUELLA DEL PONTE WHATSAPP (`PONTE_WA_TOKEN`, header
 *   `X-HGL-Token`): stesso Mac, stesso titolare, nessun segreto nuovo da
 *   mettere. Senza segreto (o più corto di 32) risponde 503, chiave sbagliata
 *   401, e il corpo si legge solo dopo la chiave giusta.
 *  ⚠️ L'utente non arriva mai dal corpo: è quello dell'installazione
 *   (`porte.utente()`), e ogni lettura e scrittura lo usa.
 *  ⚠️ Nei log solo codici: mai testi, numeri o nomi.
 *  ───────────────────────────────────────────────────────────────────────── */
import { leggiCorpoLimitato, stessaChiave } from "../manychat/ritorno";
import { lavoroPerMac, leggiRichiestaMac, type LavoroMac, type MessaggioRiga } from "./regole";
import type { LeadData } from "@/crm/types";

export const TOKEN_MINIMO = 32;
export const CORPO_MAX = 16 * 1024;

export interface RichiestaInCoda {
  id: string;
  telefono: string;
  messaggi: string[];
  indicazione: string | null;
}

export interface PorteRisposteAi {
  avviso: (codice: string) => void;
  utente: () => Promise<string | null>;
  /** il Mac è vivo: si segna l'ora (per «PC acceso» nel CRM) */
  battito: (userId: string) => Promise<void>;
  /** la prossima richiesta, già segnata «in_lavoro»; `null` se non ce ne sono */
  prendi: (userId: string) => Promise<RichiestaInCoda | null>;
  /** gli ultimi messaggi della chat di quel numero (dell'utente), più i
   *  scelti anche se sono più vecchi */
  messaggiChat: (userId: string, telefono: string, scelti: string[]) => Promise<MessaggioRiga[]>;
  /** la scheda della chat e il nome del consulente, se c'è */
  scheda: (
    userId: string,
    telefono: string,
  ) => Promise<{ lead: Partial<LeadData> | null; consulente: string | null }>;
  /** scrive l'esito, solo se la richiesta è dell'utente e ancora «in_lavoro» */
  chiudi: (
    userId: string,
    id: string,
    esito: { risposta: string } | { errore: string },
  ) => Promise<boolean>;
}

const json = (stato: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export async function gestisciRisposteAi(
  porte: PorteRisposteAi,
  i: { request: Request; segreto: string | undefined },
): Promise<Response> {
  if (!i.segreto || i.segreto.length < TOKEN_MINIMO) {
    porte.avviso("non_configurato");
    return json(503, { errore: "non_configurato" });
  }
  if (!stessaChiave(i.request.headers.get("x-hgl-token"), i.segreto)) {
    porte.avviso("non_autorizzato");
    return json(401, { errore: "non_autorizzato" });
  }
  const letto = await leggiCorpoLimitato(i.request.body, CORPO_MAX);
  if (letto.troppoGrande) return json(413, { errore: "troppo_grande" });
  let corpo: unknown = null;
  try {
    corpo = JSON.parse(letto.testo);
  } catch {
    corpo = null;
  }
  const r = leggiRichiestaMac(corpo);
  if (!r) return json(400, { errore: "corpo_non_valido" });

  try {
    const userId = await porte.utente();
    if (!userId) {
      porte.avviso("senza_utente");
      return json(503, { errore: "non_configurato" });
    }
    if (r.azione === "consegna" || r.azione === "fallita") {
      const ok = await porte.chiudi(
        userId,
        r.id,
        r.azione === "consegna" ? { risposta: r.risposta } : { errore: r.errore },
      );
      return json(ok ? 200 : 409, { ok });
    }

    await porte.battito(userId);
    //  Una richiesta i cui messaggi non ci sono più si chiude come errore e si
    //  passa alla successiva: il Mac non resta mai bloccato su una riga.
    for (let giri = 0; giri < 5; giri++) {
      const q = await porte.prendi(userId);
      if (!q) return json(200, { lavoro: null });
      const [messaggi, { lead, consulente }] = await Promise.all([
        porte.messaggiChat(userId, q.telefono, q.messaggi),
        porte.scheda(userId, q.telefono),
      ]);
      const lavoro: LavoroMac | null = lavoroPerMac({
        id: q.id,
        indicazione: q.indicazione,
        scelti: q.messaggi,
        messaggi,
        lead,
        consulente,
      });
      if (lavoro) return json(200, { lavoro });
      await porte.chiudi(userId, q.id, { errore: "messaggi_mancanti" });
    }
    return json(200, { lavoro: null });
  } catch {
    porte.avviso("errore_database");
    return json(500, { errore: "database" });
  }
}
