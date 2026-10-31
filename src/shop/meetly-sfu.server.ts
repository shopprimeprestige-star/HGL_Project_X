/** ── MEETLY · L'SFU DI CLOUDFLARE: IL COLLANTE DI PRODUZIONE ─────────────────
 *
 *  Commessa 2026-10-31-meetly-connessione, Parte B (PIANO.md §1.4, §1.5).
 *  Mette insieme, per la rotta `/api/public/meetly-sfu`, le cose vere che il
 *  nucleo (`meetly-sfu-stanza.ts`) riceve iniettate:
 *    · l'archivio    → `app_config` (service role, solo qui sul server);
 *    · la stanza viva → `session_live:<codice>` col battito di 70 secondi;
 *    · «ammesso»     → la sala d'attesa, con la stessa prova di `shop/uscita`;
 *    · Cloudflare    → i due segreti del servizio.
 *
 *  ── ⚠️ I SEGRETI ─────────────────────────────────────────────────────────
 *  `MEETLY_SFU_APP_ID` e `MEETLY_SFU_APP_TOKEN` sono di un'app Cloudflare
 *  SEPARATA da quella del webinar (obiezione 7: con l'app condivisa il buco di
 *  «aggiungi» del webinar si aprirebbe sulle consulenze). Si impostano come gli
 *  altri segreti del servizio, `npx wrangler secret put …` (vedi `DEPLOY.md`,
 *  `PONTE_WA_TOKEN`), e si leggono SOLO da `process.env`: mai in un file, mai
 *  in `app_config`, mai in un log o in una risposta. Se mancano, o l'appId ha
 *  una forma sospetta, `cloudflare` è `null` e il nucleo risponde
 *  `non-configurato` (503): nessun ripiego "di prova", nessuna scorciatoia.
 *
 *  ── ⚠️ UN ELENCO CON IL PREFISSO, NON UN'ESPRESSIONE ─────────────────────
 *  `like('meetly_sfu:<codice>:%')`: in LIKE il `_` di «meetly_sfu» vale «un
 *  carattere qualsiasi». È innocuo (nessun'altra chiave somiglia a
 *  «meetly?sfu:…») e il codice, già ridotto a lettere, cifre e trattini, non
 *  porta mai né `_` né `%`. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chiaveSessione } from "@/shop/chiave-sessione";
import { creaCloudflare } from "@/shop/meetly-sfu-cloudflare";
import { sessioneViva, type Archivio, type DipendenzeStanza } from "@/shop/meetly-sfu-stanza";
import { archivioSala } from "@/routes/api.public.sala-attesa";
import { trattaStato } from "@/shop/uscita";

const config = () => supabaseAdmin.from("app_config");

const archivio: Archivio = {
  leggi: async (chiave) => {
    const { data } = await config().select("value").eq("key", chiave).maybeSingle();
    return data?.value ?? null;
  },
  scrivi: async (chiave, valore) => {
    const { error } = await config().upsert(
      { key: chiave, value: valore, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
    return error?.message ?? "";
  },
  cancella: async (chiave) => {
    await config().delete().eq("key", chiave);
  },
  elenca: async (prefisso) => {
    const { data } = await config().select("key, value").like("key", `${prefisso}%`).limit(200);
    return (data ?? []).map((r) => ({ chiave: r.key, valore: r.value ?? "" }));
  },
  ripulisci: async (prefisso, primaDi) => {
    await config().delete().like("key", `${prefisso}%`).lt("updated_at", new Date(primaDi).toISOString());
  },
};

/** Il client Cloudflare coi segreti del servizio, o `null` se mancano. */
function cloudflareDaAmbiente() {
  const appId = process.env.MEETLY_SFU_APP_ID;
  const token = process.env.MEETLY_SFU_APP_TOKEN;
  if (!appId || !token) return null;
  try {
    return creaCloudflare({ appId, token });
  } catch {
    //  appId di forma sospetta: come se mancasse (il nucleo risponde «non-configurato»).
    return null;
  }
}

export function stanzaDiProduzione(): DipendenzeStanza {
  return {
    archivio,
    cloudflare: cloudflareDaAmbiente(),
    fuori: {
      stanzaViva: async (codice) => {
        const [specifica, storica] = await Promise.all([
          archivio.leggi(chiaveSessione("session_live", codice)),
          archivio.leggi("session_live"),
        ]);
        return sessioneViva(specifica, storica, codice, Date.now());
      },
      ammesso: async (codice, pid, dev, segreto) => {
        const r = await trattaStato(archivioSala, { sess: codice, pid, dev, segreto });
        return r.body.stato === "ammesso";
      },
      adesso: () => Date.now(),
    },
    //  Una riga già ripulita dal nucleo (niente SDP, indirizzi, codici stanza).
    log: (riga) => console.warn(riga),
  };
}
