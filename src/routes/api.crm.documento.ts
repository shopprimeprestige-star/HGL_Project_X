/** ── LEGGERE UN DOCUMENTO E RIEMPIRE LA FATTURA ────────────────────────────
 *
 *  POST con la fotografia della tessera sanitaria (o della carta d'identità) →
 *  i campi che servono a fatturare, già puliti e controllati.
 *
 *  ⚠️ LA FOTOGRAFIA NON SI SALVA DA NESSUNA PARTE. È un documento d'identità:
 *   arriva, si legge, si butta. Non finisce su Storage, non finisce in
 *   `app_config`, non finisce nei log — l'unica cosa che resta sono i campi
 *   della fattura, che su quella fattura ci devono stare comunque.
 *
 *  ⚠️ E NON SI CHIEDE PIÙ DI QUELLO CHE SERVE: nome, cognome, codice fiscale e
 *   residenza. Data di nascita, numero del documento e scadenza non servono a
 *   fatturare, e un dato personale che non serve è un dato personale che non va
 *   chiesto (vedi PROMPT_DOCUMENTO).
 *
 *  ⚠️ IL PERMESSO È «pagamenti», lo stesso con cui si emettono le fatture: chi
 *   non può fatturare non ha ragione di far leggere al programma la carta
 *   d'identità di un cliente.
 */
import { createFileRoute } from "@tanstack/react-router";
import { leggiConfigAI } from "./api.crm.ai";
import { chiamanteCRM, nonAutenticatoCRM, vietatoCRM } from "./api.crm.accesso";
import {
  documentoAccettabile,
  leggiJsonDocumento,
  PROMPT_DOCUMENTO,
} from "@/crm/fatture/lettura-documento";

const PERMESSO = "pagamenti" as const;

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** ⚠️ Un modello che vede, e scelto QUI: la configurazione può contenere un
 *  modello imposto a mano per le immagini generate (che è un'altra cosa) o
 *  restare vuota. Un modello senza occhi risponderebbe «non vedo nessuna
 *  immagine», e il guasto sembrerebbe della fotografia. */
const MODELLO = "google/gemini-2.5-flash";

export const Route = createFileRoute("/api/crm/documento")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const chi = await chiamanteCRM(request);
        if (!chi) return nonAutenticatoCRM({});
        if (!chi.accesso.puo(PERMESSO)) return vietatoCRM({}, PERMESSO);

        let b: { foto?: string; file?: string[] };
        try {
          b = (await request.json()) as typeof b;
        } catch {
          return json({ ok: false, errore: "Richiesta illeggibile" }, 400);
        }
        /** ── ⚠️ PIÙ FILE INSIEME, E LI LEGGE TUTTI IN UNA VOLTA ───────────
         *  Fronte e retro della stessa tessera, o tessera più carta d'identità:
         *  i dati stanno su facce diverse — il codice fiscale sulla tessera, la
         *  residenza sulla carta — e leggerli in chiamate separate vorrebbe
         *  dire due risposte parziali da ricucire qui, senza sapere quale
         *  delle due ha ragione. Al modello arrivano insieme, e li unisce lui
         *  che li sta guardando.
         *  ⚠️ Un tetto c'è: sei file. Chi ne carica venti sta caricando
         *   un'altra cosa, e ogni file è tempo e credito speso. */
        const arrivati = Array.isArray(b.file) ? b.file : b.foto ? [String(b.foto)] : [];
        if (arrivati.length === 0) return json({ ok: false, errore: "Non è arrivato nessun file" }, 400);
        if (arrivati.length > 6) {
          return json({ ok: false, errore: "Troppi file insieme: al massimo sei." }, 400);
        }
        const pezzi: { url: string; tipo: "immagine" | "pdf" }[] = [];
        for (const f of arrivati) {
          const buono = documentoAccettabile(String(f || ""));
          if (!buono.ok) return json({ ok: false, errore: buono.perche }, 400);
          pezzi.push({ url: String(f), tipo: buono.tipo ?? "immagine" });
        }

        const cfg = await leggiConfigAI();
        if (!cfg.pronto) {
          return json(
            {
              ok: false,
              errore: "Manca la chiave dell'intelligenza artificiale: si mette da Impostazioni.",
            },
            400,
          );
        }

        try {
          const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${cfg.apiKey}`,
              "HTTP-Referer": "https://hair-genius-hub.hair",
              "X-Title": "Lettura documento",
            },
            body: JSON.stringify({
              model: MODELLO,
              //  Poche centinaia di token: la risposta è un JSON di sette campi,
              //  e un tetto basso costa meno e taglia le divagazioni.
              max_tokens: 600,
              //  ⚠️ Un PDF non è un'immagine e non si passa come tale: va
              //   nella parte «file», e OpenRouter vuole che sia dichiarato
              //   quale motore lo apre. «native» lo consegna al modello, che
              //   le pagine le sa guardare — passarlo a un lettore di testo
              //   perderebbe proprio le tessere scansionate, che testo non ne
              //   hanno.
              ...(pezzi.some((p) => p.tipo === "pdf")
                ? { plugins: [{ id: "file-parser", pdf: { engine: "native" } }] }
                : {}),
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: PROMPT_DOCUMENTO },
                    ...pezzi.map((p, i) =>
                      p.tipo === "pdf"
                        ? {
                            type: "file",
                            file: { filename: `documento-${i + 1}.pdf`, file_data: p.url },
                          }
                        : { type: "image_url", image_url: { url: p.url } },
                    ),
                  ],
                },
              ],
            }),
          });
          if (!r.ok) {
            const grezzo = (await r.text()).slice(0, 300);
            //  ⚠️ Il guasto si dice in italiano: davanti a un cliente, il JSON
            //   di OpenRouter è un muro di graffe che sembra un sito rotto.
            return json(
              {
                ok: false,
                errore:
                  r.status === 402
                    ? "Il credito dell'intelligenza artificiale è finito."
                    : "Non sono riuscito a leggere il documento. Riprova fra poco.",
                dettaglio: grezzo,
              },
              502,
            );
          }
          const corpo = (await r.json()) as {
            choices?: { message?: { content?: unknown } }[];
          };
          const c = corpo.choices?.[0]?.message?.content;
          const testo =
            typeof c === "string"
              ? c
              : Array.isArray(c)
                ? c.map((p) => (p as { text?: string })?.text || "").join(" ")
                : "";
          const dati = leggiJsonDocumento(testo);
          //  Niente di leggibile: non è un guasto del programma, è una
          //  fotografia storta — e va detto così, perché il rimedio è rifarla.
          if (Object.keys(dati).length === 0) {
            return json({
              ok: false,
              errore:
                "Dal documento non sono riuscito a leggere niente di sicuro. "
                + "Riprova con una foto più dritta e più illuminata.",
            });
          }
          return json({ ok: true, dati });
        } catch (e) {
          return json(
            { ok: false, errore: `Lettura interrotta: ${String((e as Error).message || e)}` },
            502,
          );
        }
      },
    },
  },
});
