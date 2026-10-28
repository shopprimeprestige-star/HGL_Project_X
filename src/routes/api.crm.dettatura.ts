/** ─────────────────────────────────────────────────────────────────────────
 *  DETTATURA DELLA CHAT WHATSAPP: VOCE → TESTO (commessa 2026-10-28-chat-dettatura)
 *
 *  POST, corpo = l'audio così com'è (Content-Type = mimeType del registratore),
 *  `x-durata-ms` = quanto è durata la registrazione.
 *  → 200 { ok: true, testo } · altrimenti { ok: false, error: <codice> }
 *    (i codici e le frasi da mostrare stanno in crm/chatwa/dettatura).
 *
 *  ⚠️ DIETRO `guardiaCRM` COL PERMESSO «lead.propri», lo stesso della chat
 *   (vedi api.crm.whatsapp-canale): solo chi è entrato nel CRM e vede la chat.
 *   La guardia viene PRIMA di leggere un solo byte dell'audio.
 *  ⚠️ L'AUDIO E IL TESTO SONO DATI PERSONALI: restano in memoria per la sola
 *   chiamata a OpenRouter. Niente archivio, niente log (nei log solo modello e
 *   codice HTTP, mai corpi di risposta).
 *  ⚠️ TETTI ANCHE QUI, NON SOLO NEL BROWSER: 10 MB letti al massimo (oltre si
 *   smette di leggere) e 2 minuti dichiarati. La dimensione è il tetto vero:
 *   la durata la dichiara il browser.
 *  ⚠️ NON INVIA NIENTE AL CLIENTE: il testo torna nella casella, da rileggere.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import {
  BYTE_MAX,
  base64DaByte,
  erroreAudio,
  formatoDaMime,
  leggiConTetto,
  testoDaRisposta,
  type CodiceDettatura,
  type FormatoAudio,
} from "@/crm/chatwa/dettatura";
import { guardiaCRM } from "./api.crm.accesso";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-crm-token, x-durata-ms",
};

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const no = (error: CodiceDettatura, status: number) => json({ ok: false, error }, status);

/** Il primo modello; se non risponde, il ripiego (SPEC). */
const MODELLI = ["openai/gpt-4o-transcribe", "openai/whisper-large-v3"] as const;
/** Due minuti d'audio si trascrivono in pochi secondi: oltre, si passa al ripiego. */
const ATTESA_MS = 45_000;

/** Una chiamata a OpenRouter: il testo pulito, "" se non c'erano parole, null se è fallita. */
async function trascrivi(
  chiave: string,
  modello: string,
  data: string,
  format: FormatoAudio,
): Promise<string | null> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${chiave}` },
      body: JSON.stringify({ model: modello, input_audio: { data, format }, language: "it" }),
      signal: AbortSignal.timeout(ATTESA_MS),
    });
    if (!res.ok) {
      console.warn("[dettatura] modello non riuscito", modello, res.status);
      return null;
    }
    const corpo = (await res.json().catch(() => null)) as { text?: unknown } | null;
    //  Risposta senza `text` (forma strana): conta come fallita, si prova il ripiego.
    if (typeof corpo?.text !== "string") return null;
    return testoDaRisposta(corpo) ?? "";
  } catch {
    console.warn("[dettatura] chiamata non riuscita", modello);
    return null;
  }
}

export const Route = createFileRoute("/api/crm/dettatura")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "lead.propri");
        if (!g.ok) return g.risposta;

        const chiave = process.env.OPENROUTER_API_KEY;
        if (!chiave) return no("non_configurata", 503);

        //  Content-Length dichiarato oltre il tetto: non si legge neanche.
        if (Number(request.headers.get("content-length") ?? 0) > BYTE_MAX) {
          return no("troppo_grande", 413);
        }
        const audio = await leggiConTetto(request.body, BYTE_MAX);
        if (!audio) return no("troppo_grande", 413);

        const formato = formatoDaMime(request.headers.get("content-type") ?? "");
        const sbagliato = erroreAudio({
          byte: audio.length,
          formato,
          durataMs: Number(request.headers.get("x-durata-ms") ?? NaN),
        });
        if (sbagliato || !formato) return no(sbagliato ?? "formato", 400);

        const data = base64DaByte(audio);
        let silenzio = false;
        for (const modello of MODELLI) {
          const testo = await trascrivi(chiave, modello, data, formato);
          if (testo) return json({ ok: true, testo });
          //  "" = il modello ha risposto ma non ha sentito parole: il ripiego non serve.
          if (testo === "") {
            silenzio = true;
            break;
          }
        }
        return silenzio ? no("niente_parlato", 422) : no("trascrizione", 502);
      },
    },
  },
});
