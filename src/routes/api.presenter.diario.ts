/** ── IL DIARIO DEL REGISTRATORE ────────────────────────────────────────────
 *
 *  Segnalazione del committente: «continua a non registrare», dopo due rimedi
 *  che in laboratorio funzionavano. Il problema, ogni volta, è stato lo
 *  stesso: il guasto succede sul SUO computer, durante una consulenza vera, e
 *  di quel momento non resta niente — le righe di console se ne vanno con la
 *  scheda, e non si chiede a chi sta lavorando di aprire gli strumenti da
 *  sviluppatore mentre ha un cliente davanti.
 *
 *  Qui il registratore lascia detto quello che ha fatto: com'era composto il
 *  miscuglio quando è partito, se i pezzi arrivavano, quanto è durato, quanti
 *  byte sono usciti. Alla prossima consulenza il diario si legge e si sa,
 *  invece di indovinare.
 *
 *  ⚠️ NON CI FINISCE NIENTE DI PRIVATO. Nomi di tracce, conteggi, durate,
 *   millisecondi: nessun contenuto della consulenza, nessun nome di cliente,
 *   nessun indirizzo. È una scatola nera, non una registrazione.
 *  ⚠️ NON DEVE POTER DISTURBARE UNA CONSULENZA: chi scrive non aspetta la
 *   risposta e ignora gli errori. Se il diario non si scrive, pazienza — la
 *   registrazione va avanti lo stesso.
 *  ⚠️ TIENE LE ULTIME `QUANTE`: è una scatola nera, non un archivio. Le righe
 *   vecchie non servono a nessuno e la riga di configurazione non deve
 *   crescere senza fine.
 *
 *  POST { voce, diario? }  → aggiunge una riga
 *  GET ?diario=…           → le righe, dalla più recente
 *
 *  ── DUE DIARI, NON UNO ────────────────────────────────────────────────────
 *  `diario: "chiamata"` è la scatola nera della videochiamata (vedi
 *  shop/scatola-chiamata): una riga ogni trenta secondi. Sta in una chiave sua
 *  perché in una consulenza ne scrive novanta, e nello stesso diario avrebbe
 *  spinto fuori in un'ora le righe del registratore.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { INTESTAZIONI_CONSENTITE, autorizzaPresentatore, nonAutorizzato } from "./api.presenter.consultant";

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

const DIARI = {
  registrazione: { chiave: "diario_registrazione", quante: 40 },
  chiamata: { chiave: "diario_chiamata", quante: 200 },
  //  La scatola nera del preventivo (shop/scatola-preventivo): una riga ogni
  //  trenta secondi, solo quando succede qualcosa.
  preventivo: { chiave: "diario_preventivo", quante: 200 },
} as const;
type Diario = keyof typeof DIARI;
const quale = (v: unknown): Diario =>
  v === "chiamata" ? "chiamata" : v === "preventivo" ? "preventivo" : "registrazione";

interface Voce {
  quando: string;
  chi: string;
  testo: string;
}

async function leggi(d: Diario): Promise<Voce[]> {
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", DIARI[d].chiave).maybeSingle();
  try {
    const v = JSON.parse(data?.value ?? "[]") as Voce[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/api/presenter/diario")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const chi = await autorizzaPresentatore(request);
        if (!chi) return nonAutorizzato(cors);
        return json({ voci: await leggi(quale(new URL(request.url).searchParams.get("diario"))) });
      },

      POST: async ({ request }) => {
        const chi = await autorizzaPresentatore(request);
        if (!chi) return nonAutorizzato(cors);
        let body: { voce?: unknown; diario?: unknown } = {};
        try { body = (await request.json()) as typeof body; } catch { /* corpo illeggibile */ }
        const testo = String(body.voce ?? "").trim().slice(0, 900);
        if (!testo) return json({ ok: false, reason: "voce vuota" }, 400);
        const d = quale(body.diario);
        const voci = await leggi(d);
        voci.unshift({ quando: new Date().toISOString(), chi: chi.nome || "", testo });
        await supabaseAdmin.from("app_config").upsert(
          { key: DIARI[d].chiave, value: JSON.stringify(voci.slice(0, DIARI[d].quante)), updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
        return json({ ok: true });
      },
    },
  },
});
