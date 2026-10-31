/** ─────────────────────────────────────────────────────────────────────────
 *  IL RIQUADRO «WHATSAPP CON MANYCHAT»: LEGGERE, CONFIGURARE, PROVARE
 *
 *  Commessa 2026-10-23, compito 4. Il riquadro in Impostazioni → WhatsApp parla
 *  solo con questa rotta. Il contratto (corpi e risposte) è in testa a
 *  `src/crm/manychat/client-crm.ts`:
 *   · GET  → lo stato, SENZA chiamare ManyChat (il riquadro lo rilegge ogni
 *     minuto);
 *   · POST { interruttori | tetti | flussi | canale } → scrive la
 *     configurazione;
 *   · POST { azione: "prova_a_secco" | "prova_collegamento" |
 *     "prova_creazione_contatto", telefono? }.
 *
 *  ⚠️ TUTTO DIETRO `guardiaCRM` COL PERMESSO «impostazioni». Canale,
 *   interruttori, tetti e flussi decidono a chi scrive il CRM da un numero
 *   unico: li scrive solo il server (tabella chiusa `manychat_config`), mai il
 *   browser. I tetti si possono solo abbassare (il server li riporta alle
 *   costanti).
 *  ⚠️ Commessa 2026-10-25: gli interruttori nuovi («Lead nuovo», «Giorno del
 *   meet», uno per stato), l'indirizzo della sede e il tetto dei lead nuovi
 *   chiedono le colonne di S2 (503 se mancano); «Lead nuovo» non si accende senza
 *   la data della frase (422); la data della frase si salva in `controlli`.
 *   `controllaComando` decide PRIMA di ogni scrittura.
 *  ⚠️ Commessa 2026-10-31 (interruttori automatici): i MESSAGGI (gli interruttori
 *   `promemoria`, `ricontatti`, `leadNuovo`, `giornoMeet` e gli `stati`) non si scrivono
 *   più da qui: li accende e spegne il registro (`/api/crm/messaggi-automatici`).
 *   `leggiComando` li rifiuta con un 400 («Si cambia in Messaggi automatici.»); resta il
 *   solo generale (`acceso`). Stesso permesso «impostazioni»: la rotta non apre niente.
 *  ⚠️ Nessuna di queste azioni manda un messaggio. La chiave di ManyChat non
 *   esce mai in una risposta; nei log solo codici, mai un numero.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { guardiaCRM } from "./api.crm.accesso";
import { chiaveManychatPresente } from "@/crm/manychat/porta.server";
import {
  clientManychat,
  leggiDatiSecco,
  leggiDatiStato,
  leggiRigaConfig,
  salvaControlli,
  unisciControlli,
  scriviConfig,
} from "@/crm/manychat/pannello.server";
import {
  aggiornaControlli,
  configDaRiga,
  configDiAltraInstallazione,
  controlliDopoCollegamento,
  controlliDopoCreazione,
  controlliDopoFrase,
  controllaComando,
  costruisciStato,
  creazioneDa,
  fraseDaGiorno,
  fraseModuloDa,
  leggiComando,
  patchDaComando,
  provaASecco,
  provaCreazione,
  statoCollegamento,
  type RigaConfig,
} from "@/crm/manychat/pannello";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-crm-token",
};

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const FRASE_TITOLARE = "Non si sa di quale installazione si parla: rientra nel CRM.";
const FRASE_ALTRA = "Questa installazione non è quella collegata a ManyChat.";
const FRASE_MIGRAZIONE = "Manca l'aggiornamento del database: il riquadro non può salvare.";

const segretoRitornoPresente = () => !!(process.env.MANYCHAT_RITORNO_TOKEN ?? "").trim();
/** Il segreto del foglio Google: il suo valore non esce mai, si dice solo se c'è. */
const segretoFoglioPresente = () => !!(process.env.SHEETS_INGRESSO_TOKEN ?? "").trim();

/** Le porte di `controlli`: la riga si rilegge ogni volta, mai la copia vecchia. */
const porteControlli = (userId: string) => ({
  leggi: async () => (await leggiRigaConfig()).riga?.controlli,
  salva: (controlli: Record<string, unknown>) => salvaControlli(userId, controlli),
  unisci: (patch: Record<string, unknown>) => unisciControlli(userId, patch),
});

/** Un guasto del database: nei log solo il codice. */
function guasto(e: unknown) {
  const code = (e as { code?: unknown } | null)?.code;
  console.warn("[manychat-pannello]", typeof code === "string" ? code : "errore");
  return json({ error: "Il server ha avuto un problema: riprova fra poco." }, 500);
}

export const Route = createFileRoute("/api/crm/manychat")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        if (!g.chi.adminUserId) return json({ error: FRASE_TITOLARE }, 403);
        try {
          const adesso = new Date();
          const cfg = await leggiRigaConfig();
          if (configDiAltraInstallazione(cfg.riga, g.chi.adminUserId))
            return json({ error: FRASE_ALTRA }, 403);
          const dati = await leggiDatiStato(g.chi.adminUserId, cfg, adesso, {
            chiave: chiaveManychatPresente(),
            segreto: segretoRitornoPresente(),
            segretoFoglio: segretoFoglioPresente(),
          });
          return json(costruisciStato(dati, adesso));
        } catch (e) {
          return guasto(e);
        }
      },

      POST: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        if (!g.chi.adminUserId) return json({ error: FRASE_TITOLARE }, 403);
        const userId = g.chi.adminUserId;

        let corpo: unknown;
        try {
          corpo = await request.json();
        } catch {
          return json({ error: "Richiesta non valida." }, 400);
        }
        const letto = leggiComando(corpo);
        if (!letto.ok) return json({ error: letto.errore }, 400);
        const c = letto.comando;

        try {
          const adesso = new Date();
          const cfg = await leggiRigaConfig();
          if (configDiAltraInstallazione(cfg.riga, userId))
            return json({ error: FRASE_ALTRA }, 403);
          const config = configDaRiga(cfg.riga, cfg.sequenze);

          // ── i comandi che scrivono: prima le regole, poi la scrittura ──
          const scrive =
            c.tipo === "interruttori" ||
            c.tipo === "tetti" ||
            c.tipo === "flussi" ||
            c.tipo === "canale" ||
            c.tipo === "stati" ||
            c.tipo === "indirizzo_sede" ||
            c.tipo === "frase_modulo";
          if (scrive) {
            if (cfg.manca) return json({ error: FRASE_MIGRAZIONE }, 503);
            const rifiuto = controllaComando(cfg.riga, c, adesso, cfg.sequenze);
            if (rifiuto) return json({ error: rifiuto.errore }, rifiuto.stato);
          }

          // ── la data della frase del consenso: sta in `controlli` ──
          if (c.tipo === "frase_modulo") {
            const frase = fraseDaGiorno(c.giorno, g.chi.nome, adesso);
            const salvata = await aggiornaControlli(porteControlli(userId), (fresco) =>
              controlliDopoFrase(fresco, frase),
            );
            if (!salvata) return json({ error: FRASE_MIGRAZIONE }, 503);
            return json({ fraseModulo: fraseModuloDa({ fraseModulo: frase }) });
          }

          // ── la configurazione ──
          if (
            c.tipo === "interruttori" ||
            c.tipo === "tetti" ||
            c.tipo === "flussi" ||
            c.tipo === "canale" ||
            c.tipo === "stati" ||
            c.tipo === "indirizzo_sede"
          ) {
            const patch = patchDaComando(cfg.riga, c, adesso);
            if (Object.keys(patch).length === 0) return json({ config });
            await scriviConfig(userId, patch, g.chi.nome, adesso);
            const dopo = await leggiRigaConfig();
            return json({ config: configDaRiga(dopo.riga, dopo.sequenze) });
          }

          // ── la prova a secco: solo letture, nessuna chiamata a ManyChat ──
          if (c.tipo === "prova_a_secco") {
            const frase = fraseModuloDa((cfg.riga as RigaConfig | null)?.controlli)?.il ?? null;
            return json(provaASecco(await leggiDatiSecco(userId, config, adesso, frase), adesso));
          }

          // ── la prova di collegamento: «chi sei?», flussi e campi ──
          if (c.tipo === "prova_collegamento") {
            const controlli = (cfg.riga as RigaConfig | null)?.controlli;
            const col = await statoCollegamento(clientManychat(userId), {
              canale: config.canale,
              interruttori: { promemoria: config.promemoria, ricontatti: config.ricontatti },
              ...(config.sequenze
                ? {
                    sequenze: {
                      leadNuovo: config.leadNuovo,
                      giornoMeet: config.giornoMeet,
                      stati: config.stati,
                    },
                  }
                : {}),
              flussi: config.flussi,
              creazione: creazioneDa((controlli as { creazione?: unknown } | null)?.creazione),
              adesso,
            });
            //  Il valore da cui si parte è riletto ADESSO, dopo l'attesa di ManyChat.
            if (!cfg.manca)
              await aggiornaControlli(porteControlli(userId), (fresco) =>
                controlliDopoCollegamento(fresco, col),
              );
            return json(col);
          }

          // ── la prova di creazione contatto: il numero va a ManyChat e basta ──
          const r = await provaCreazione(clientManychat(userId), c.telefono);
          if (r.stato === 400) return json({ error: r.errore }, 400);
          if (r.registra && !cfg.manca) {
            const esito = { esito: r.registra, il: adesso.toISOString() };
            await aggiornaControlli(porteControlli(userId), (fresco) =>
              controlliDopoCreazione(fresco, esito),
            );
          }
          return json(r.risposta);
        } catch (e) {
          return guasto(e);
        }
      },
    },
  },
});
