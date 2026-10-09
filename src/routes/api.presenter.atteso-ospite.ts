/** ── CHI ENTRA DAL LINK DIVENTA UNA PERSONA DELLA STANZA ───────────────────
 *
 *  Segnalazione del committente, con le due schermate affiancate: sul pannello
 *  «Il suo — lo compila lui» era acceso, e il cliente vedeva lo stesso le
 *  facce ogni volta che il consulente passava alla videochiamata.
 *
 *  ⚠️ NON ERA L'INTERRUTTORE: era che quel cliente NON ESISTEVA come persona.
 *   La precedenza («il suo preventivo vince su tutto») si regge su un gettone:
 *   il server risponde «vai sul TUO preventivo» a chi ne ha uno acceso
 *   (`paginaDiQuestoCliente`), e il dispositivo rifiuta i cambi di modalità
 *   solo quando quella precedenza è alzata. Chi entra scrivendo il proprio
 *   nome alla porta non ha nessun gettone: non ha una stanza di preventivo
 *   sua, quindi non può avere niente da difendere, e ogni mossa del consulente
 *   se lo portava dietro.
 *
 *  Qui si chiude il buco alla radice: quando la stanza non ha attesi e qualcuno
 *  è collegato, il consulente lo REGISTRA come persona della consulenza. Da
 *  quel momento ha un gettone, e tutto il resto — precedenza, penna, pannello,
 *  riassunto — funziona come per chi era in agenda, senza un solo caso a parte.
 *
 *  ⚠️ E il cliente lo scopre da sé: la sua pagina chiede `/api/public/attesi`,
 *   trova UNA persona attesa e si riconosce (`personaDaAdottare`), che è la
 *   regola che esisteva già per le consulenze da appuntamento.
 *  ⚠️ Non si sovrascrive MAI un elenco già scritto: se la stanza ha i suoi
 *   attesi veri, questa rotta non tocca niente e li restituisce.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chiaveAttesi, gettoneDi, leggiAttesi, scriviAttesi, unisciAttesi, type PersonaAttesa } from "@/crm/fascia-consulenza";
import { chiaveSessione } from "@/shop/chiave-sessione";
import { stanzaDelPreventivo } from "@/shop/preventivi-di-gruppo";
import { INTESTAZIONI_CONSENTITE, guardia } from "./api.presenter.consultant";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE };
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** L'identificativo di un ospite senza scheda. Non è l'id di un cliente del
 *  CRM — non apre niente là dentro — ed è stabile per questo dispositivo in
 *  questa stanza, così un ricaricamento non conia una persona nuova. */
const idDellOspite = (dev: string, sess: string): string =>
  `ospite${`${dev || sess}`.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase()}`;

export const Route = createFileRoute("/api/presenter/atteso-ospite")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        const no = await guardia(request, cors, { attesi: [] });
        if (no) return no;
        let b: { sess?: string; nome?: string; dev?: string } = {};
        try { b = (await request.json()) as typeof b; } catch { /* corpo illeggibile */ }
        const sess = String(b.sess || "").trim();
        if (!sess) return json({ ok: false, reason: "manca la stanza" }, 400);

        const chiave = chiaveAttesi(sess);
        const { data } = await supabaseAdmin
          .from("app_config").select("value").eq("key", chiave).maybeSingle();
        const gia = leggiAttesi((data as { value?: string | null } | null)?.value);
        //  ⚠️ C'è già qualcuno: non si tocca niente. Questo elenco è quello che
        //   il consulente ha preparato in agenda, e sovrascriverlo vorrebbe
        //   dire perdere i nomi veri dei suoi clienti.
        if (gia.length) return json({ ok: true, attesi: gia, aggiunto: false });

        const persona: PersonaAttesa = {
          leadId: idDellOspite(String(b.dev || ""), sess),
          nome: String(b.nome || "").trim().slice(0, 40) || "Cliente",
        };
        const lista = unisciAttesi(gia, persona);
        const { error } = await supabaseAdmin.from("app_config").upsert(
          { key: chiave, value: scriviAttesi(lista), updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
        if (error) return json({ ok: false, reason: error.message }, 500);
        console.log(`[ATTESI] ${sess}: registrato l'ospite «${persona.nome}» entrato dal link`);

        /*  ── ⚠️ E IL PREVENTIVO CHE STAVA GIÀ COMPILANDO SI PORTA DIETRO ──
            Fino a un attimo fa quel cliente, senza gettone, scriveva nella
            stanza COMUNE: è lì che stanno le voci che ha già scelto. Dandogli
            una stanza sua, senza questa copia, si ritroverebbe il preventivo
            vuoto davanti — in mezzo a una consulenza, e per colpa nostra.
            Si copia SOLO se la sua stanza non esiste ancora: non si sovrascrive
            mai un preventivo, nemmeno il proprio. */
        try {
          const g = gettoneDi(persona);
          const sua = chiaveSessione("quote_state", stanzaDelPreventivo(sess, g));
          const comune = chiaveSessione("quote_state", stanzaDelPreventivo(sess, ""));
          const { data: righe } = await supabaseAdmin
            .from("app_config").select("key,value").in("key", [sua, comune]);
          const mappa = new Map((righe as { key: string; value?: string | null }[] | null ?? []).map((r) => [r.key, r.value]));
          const daCopiare = mappa.get(comune);
          if (!mappa.has(sua) && daCopiare) {
            await supabaseAdmin.from("app_config").upsert(
              { key: sua, value: daCopiare, updated_at: new Date().toISOString() },
              { onConflict: "key" },
            );
            console.log(`[ATTESI] ${sess}: il preventivo che stava compilando è passato nella sua stanza`);
          }
        } catch { /* la copia è una cortesia: se non riesce, la registrazione vale lo stesso */ }

        return json({ ok: true, attesi: lista, aggiunto: true });
      },
    },
  },
});
