/** ── LA PORTA D'INGRESSO, LATO CONSULENTE ──────────────────────────────────
 *
 *  Segnalazione del committente: «quando una persona entra rimane in attesa e
 *  non entra mai». La metà lato cliente sta in api.public.sala-attesa, e lì è
 *  spiegato per esteso perché la sala d'attesa non può vivere solo sul canale
 *  in tempo reale. Qui c'è la metà del consulente:
 *
 *  GET  ?sess=CODICE                  -> { ok, attesa: [{pid, nome, dev, at}] }
 *  POST { sess, pid, stato }          -> { ok }   «entra» / «non ora»
 *
 *  ⚠️ DIETRO LA SESSIONE DEL PRESENTATORE: da qui escono i NOMI dei clienti in
 *   attesa, e da qui si apre la porta di una consulenza. Senza sessione, 401 e
 *   nessun dato — come per l'elenco dei preventivi.
 *  ⚠️ LA DECISIONE SI SCRIVE ANCHE SE LA BUSSATA NON C'È ANCORA: il consulente
 *   può premere «fai entrare» nell'istante esatto in cui la riga viene ripulita
 *   o prima che la prima bussata arrivi sul server (il canale è più veloce).
 *   Scriverla comunque vuol dire che chi bussa un secondo dopo trova il via
 *   libera già pronto — vedi `decidi` in shop/sala-attesa.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import {
  INTESTAZIONI_CONSENTITE,
  autorizzaPresentatore,
  nonAutorizzato,
} from "./api.presenter.consultant";
import { leggiRigaSala, scriviRigaSala } from "./api.public.sala-attesa";
import { decidi, inAttesa, type StatoAttesa } from "@/shop/sala-attesa";
//  Chi era atteso in questa stanza: serve a scrivere sul riquadro il nome
//  della SCHEDA invece di quello digitato al volo dal cliente.
import { attesiDellaStanza } from "./api.public.attesi";
import { attesoDalGettone, gettoneDi } from "@/crm/fascia-consulenza";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE,
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/presenter/sala-attesa")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const u = new URL(request.url);
        const sess = String(u.searchParams.get("sess") || "").trim();
        if (!sess) return json({ ok: false, reason: "manca la stanza" }, 400);
        const chi = await autorizzaPresentatore(request, u.searchParams.get("code"));
        if (!chi) return nonAutorizzato(cors);
        const [persone, attesi] = await Promise.all([leggiRigaSala(sess), attesiDellaStanza(sess)]);
        /*  ── IL NOME VERO, NON QUELLO DIGITATO ────────────────────────
            Chi è entrato scegliendo il proprio nome porta con sé il gettone
            della sua scheda: al consulente si scrive il nome e cognome che ha
            in archivio, che è quello con cui chiamerà quella persona. Per chi
            è arrivato da un link inoltrato resta quello che ha scritto lui. */
        return json({
          ok: true,
          /*  ── CHI ERA ATTESO, ANCHE SE NON HA ANCORA BUSSATO ───────────
              Serve al consulente per due cose: sapere chi manca ancora, e
              riconoscere al volo — sul canale, senza aspettare questa
              lettura — chi sta bussando. Qui i nomi sono INTERI: siamo
              dietro alla sua sessione, e sono i suoi clienti. */
          attesi: attesi.map((p) => ({
            gettone: gettoneDi(p),
            nome: `${p.nome}${p.cognome ? ` ${p.cognome}` : ""}`.trim(),
            leadId: p.leadId,
          })),
          attesa: inAttesa(persone).map((p) => {
            //  ⚠️ Nome diverso da `chi`, che qui sopra è il CONSULENTE
            //   autorizzato: due cose diverse con lo stesso nome, in una
            //   rotta che decide chi entra, è il modo di sbagliarsi.
            const atteso = attesoDalGettone(attesi, p.persona);
            return {
              pid: p.pid,
              nome: atteso ? `${atteso.nome}${atteso.cognome ? ` ${atteso.cognome}` : ""}`.trim() : p.nome,
              dev: p.dev ?? "",
              at: p.at,
              //  ⚠️ «non era fra gli attesi» è un'informazione che il
              //   consulente deve avere: con la porta aperta entra anche chi
              //   ha ricevuto il link inoltrato da un amico.
              atteso: !!atteso,
              ...(atteso ? { leadId: atteso.leadId } : {}),
            };
          }),
        });
      },

      POST: async ({ request }) => {
        let b: { sess?: string; pid?: string; dev?: string; stato?: string; code?: string } = {};
        try { b = (await request.json()) as typeof b; } catch { /* corpo illeggibile */ }
        const sess = String(b.sess || "").trim();
        const pid = String(b.pid || "").trim();
        /*  ── ⚠️ IL DISPOSITIVO DI CHI SI STA FACENDO ENTRARE ──────────────
            Il pid è di una PAGINA e cambia a ogni ricaricamento: l'elenco del
            consulente può averne uno vecchio, e la decisione presa su quel pid
            non arrivava a nessuno («lo accetto e continua a dirgli sei in
            attesa»). Col dispositivo la decisione si posa sulla PERSONA, che
            è quella che sta aspettando davvero. Vedi `decidi`. */
        const dev = String(b.dev || "").trim();
        const stato: StatoAttesa = b.stato === "rifiutato" ? "rifiutato" : "ammesso";
        if (!sess || (!pid && !dev)) return json({ ok: false, reason: "manca la stanza" }, 400);
        const chi = await autorizzaPresentatore(request, b.code);
        if (!chi) return nonAutorizzato(cors);
        const errore = await scriviRigaSala(sess, decidi(await leggiRigaSala(sess), pid, stato, Date.now(), dev));
        if (errore) return json({ ok: false, reason: errore }, 500);
        console.log(`[SALA] ${pid}${dev ? ` (dispositivo ${dev.slice(0, 8)})` : ""} → ${stato} in ${sess} da ${chi.nome}`);
        return json({ ok: true, stato });
      },
    },
  },
});
