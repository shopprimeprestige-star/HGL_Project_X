/** Configurazione ICE/TURN per la videochiamata.
 *  GET  -> { iceServers: [...], hasTurn }  (STUN + TURN)
 *  POST -> salva la configurazione TURN in app_config.key = 'turn_config'
 *
 *  Sono supportati DUE modi di avere un TURN (necessario per far connettere
 *  la chiamata tra reti diverse, es. laptop + telefono in 4G):
 *
 *   A) Cloudflare TURN (consigliato, 1TB/mese gratis) — salvi:
 *        { cfKeyId, cfApiToken }
 *      e il server genera credenziali TEMPORANEE ad ogni richiesta.
 *
 *   B) TURN manuale (Metered/Twilio/coturn) — salvi:
 *        { url, username, credential }
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sessioneDaRichiesta } from "./api.presenter.consultant";
import { chiamanteCRM } from "./api.crm.accesso";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  //  Le due credenziali del gestionale vanno DICHIARATE o il browser non le
  //  lascia nemmeno partire: il pannello delle impostazioni salva da lì.
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-crm-token, x-presenter-token",
};

/** ── ⚠️ CHI PUÒ RISCRIVERE IL TURN ─────────────────────────────────────────
 *  QUESTA PORTA ERA SPALANCATA. Il POST non chiedeva niente a nessuno: un
 *  qualunque estraneo che avesse indovinato l'indirizzo poteva sostituire il
 *  server TURN, e da quel momento OGNI videochiamata dello studio — consulenze
 *  comprese — avrebbe tentato di passare per un server suo. Nel migliore dei
 *  casi le chiamate smettono di collegarsi; nel peggiore l'audio e il video di
 *  una consulenza sulla salute di una persona attraversano una macchina di
 *  qualcun altro.
 *
 *  Adesso servono credenziali, e ce ne sono DUE perché due sono i posti da cui
 *  si salva davvero: il pannello dentro Meetly (sessione da presentatore, che
 *  viaggia nel cookie — per questo la sua schermata continua a funzionare
 *  senza una riga di modifica) e le impostazioni del gestionale.
 *
 *  ⚠️ IL «GET» RESTA APERTO, ed è voluto: gli indirizzi STUN e le credenziali
 *   TURN a termine servono a OGNI partecipante, compreso il cliente che apre
 *   il link senza essere nessuno. Sono generate per l'occasione e scadono; è
 *   la scrittura a essere pericolosa, non la lettura. */
async function puoScrivere(request: Request, token?: unknown): Promise<boolean> {
  if (await sessioneDaRichiesta(request)) return true;
  const chi = await chiamanteCRM(request, token);
  return !!chi?.accesso.puo("consulenti");
}
const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

// Più STUN per massimizzare i candidati riflessivi (srflx).
const STUN: RTCIceServer[] = [
  { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

type TurnCfg = { url?: string; username?: string; credential?: string; cfKeyId?: string; cfApiToken?: string };

/** Chiede a Cloudflare credenziali TURN temporanee. Ritorna [] se fallisce. */
async function cloudflareIce(keyId: string, apiToken: string): Promise<RTCIceServer[]> {
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: 86400 }),
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { iceServers?: RTCIceServer | RTCIceServer[] };
    if (!j.iceServers) return [];
    return Array.isArray(j.iceServers) ? j.iceServers : [j.iceServers];
  } catch {
    return [];
  }
}

async function leggiCfg(): Promise<TurnCfg> {
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", "turn_config").maybeSingle();
  try { return JSON.parse((data as { value?: string } | null)?.value ?? "{}") || {}; } catch { return {}; }
}

export const Route = createFileRoute("/api/public/turn")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const cfg = await leggiCfg();

        //  ── COM'È CONFIGURATO, SENZA I SEGRETI ──────────────────────────
        //   Serve al pannello delle impostazioni per mostrare cosa c'è già.
        //   Restituisce l'identificativo della chiave (che da solo non apre
        //   niente) e un semplice sì/no sui segreti: quelli non escono mai.
        if (new URL(request.url).searchParams.get("stato") === "1") {
          if (!(await puoScrivere(request, new URL(request.url).searchParams.get("token")))) {
            return new Response(JSON.stringify({ error: "non autorizzato" }), {
              status: 401,
              headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
            });
          }
          return json({
            cfKeyId: cfg.cfKeyId || "",
            haCfApiToken: !!cfg.cfApiToken,
            url: cfg.url || "",
            username: cfg.username || "",
            haCredential: !!cfg.credential,
          });
        }

        const iceServers: RTCIceServer[] = [...STUN];
        let hasTurn = false;

        // A) Cloudflare TURN (temporaneo, generato ora)
        if (cfg.cfKeyId && cfg.cfApiToken) {
          const cf = await cloudflareIce(cfg.cfKeyId, cfg.cfApiToken);
          if (cf.length) { iceServers.push(...cf); hasTurn = true; }
        }
        // B) TURN manuale
        if (cfg.url && cfg.username && cfg.credential) {
          const bases = cfg.url.split(",").map((u) => u.trim()).filter(Boolean);
          iceServers.push({ urls: bases, username: cfg.username, credential: cfg.credential });
          hasTurn = true;
        }
        return json({ iceServers, hasTurn });
      },
      POST: async ({ request }) => {
        let body: TurnCfg & { token?: unknown } = {};
        try { body = (await request.json()) as typeof body; } catch { /* ignore */ }
        if (!(await puoScrivere(request, body.token))) {
          return new Response(JSON.stringify({ error: "non autorizzato" }), {
            status: 401,
            headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }
        //  I segreti si riscrivono SOLO se ne arriva uno nuovo: la schermata
        //  non li rilegge mai, quindi un campo vuoto vuol dire «non l'ho
        //  toccato», non «cancellalo». Senza questa regola, aprire le
        //  impostazioni e salvare un dettaglio qualsiasi spegnerebbe il TURN.
        const prima = await leggiCfg();
        const value = JSON.stringify({
          url: (body.url ?? prima.url ?? "").trim(),
          username: (body.username ?? prima.username ?? "").trim(),
          credential: (body.credential || "").trim() || (prima.credential ?? ""),
          cfKeyId: (body.cfKeyId ?? prima.cfKeyId ?? "").trim(),
          cfApiToken: (body.cfApiToken || "").trim() || (prima.cfApiToken ?? ""),
        });
        await supabaseAdmin.from("app_config").upsert(
          { key: "turn_config", value, updated_at: new Date().toISOString() } as never,
          { onConflict: "key" },
        );
        return json({ ok: true });
      },
    },
  },
});
