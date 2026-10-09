/** ── PORTARSI VIA IL PROGRAMMA, NON SOLO I DATI ────────────────────────────
 *
 *  Richiesta del committente: «fai che posso scaricare tutto il sito, i lead,
 *  il funzionamento, il software Meetly, tutto il database e il sito web, per
 *  clonarlo e installarlo su un altro database/hosting: il 100% di tutto».
 *
 *  I DATI il gestionale li sapeva già dare (api.crm.backup). Qui ci sono le
 *  altre due metà:
 *
 *   GET            -> la SORGENTE del programma: un collegamento che scade,
 *                     all'archivio depositato dall'ultima pubblicazione
 *                     (strumenti/sorgente.mjs).
 *   GET ?file=1    -> l'elenco dei FILE caricati (registrazioni, immagini,
 *                     documenti, anteprime) con un collegamento per ciascuno.
 *
 *  ── ⚠️ PERCHÉ LA SORGENTE NON SI PUÒ PRODURRE QUI ────────────────────────
 *  Quello che gira su Cloudflare è la COSTRUZIONE: codice rimpicciolito, nomi
 *  accorciati, commenti buttati via. Da lì non si torna indietro. La sorgente
 *  leggibile esiste solo sul computer di chi pubblica, e per questo la si
 *  deposita in un contenitore privato nel momento della pubblicazione: questa
 *  rotta non la fabbrica, la consegna.
 *
 *  ── ⚠️ CHI PUÒ ───────────────────────────────────────────────────────────
 *  Il permesso «impostazioni», che è quello del titolare. La sorgente è il
 *  programma intero e l'elenco dei file porta i collegamenti ai documenti dei
 *  clienti: non è roba da lasciare dietro a una sessione qualunque.
 *  ⚠️ I COLLEGAMENTI SCADONO. Si firmano per un'ora: il tempo di scaricare,
 *   non di restare in giro per sempre dentro una chat.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { guardiaCRM } from "./api.crm.accesso";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-crm-token",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** Un'ora: il tempo di scaricare, non di restare in giro per sempre. */
const DURATA_COLLEGAMENTO = 3600;
const CONTENITORE = "sorgente";
const CHIAVE_ULTIMA = "sorgente_ultima";

/** I contenitori dei file caricati, con che cosa c'è dentro. L'elenco è
 *  esplicito: così chi riceve il pacchetto sa che cosa sta guardando, e un
 *  contenitore nuovo non finisce nell'esportazione senza che nessuno l'abbia
 *  deciso. */
const CONTENITORI_FILE: { nome: string; cosa: string }[] = [
  { nome: "registrazioni", cosa: "le videoregistrazioni delle consulenze" },
  { nome: "media", cosa: "foto e documenti caricati sulle schede dei clienti" },
  { nome: "anteprime", cosa: "le immagini che si vedono mandando un link su WhatsApp" },
  { nome: "documenti", cosa: "fatture, ricevute e allegati della contabilità" },
  { nome: "prova-capelli", cosa: "le prove colore e le simulazioni" },
  { nome: "copie", cosa: "le copie automatiche dei dati" },
];

type Oggetto = { name?: string; id?: string | null; updated_at?: string | null; metadata?: { size?: number } | null };

const deposito = supabaseAdmin.storage;

/** Tutti gli oggetti di un contenitore, a pagine: una lettura liscia si ferma
 *  a cento file e un elenco che si ferma a cento è peggio di nessun elenco,
 *  perché uno ci conta sopra. */
async function tuttiGliOggetti(contenitore: string, dentro = "", profondita = 0): Promise<{ percorso: string; byte: number; quando: string }[]> {
  if (profondita > 3) return [];
  const out: { percorso: string; byte: number; quando: string }[] = [];
  const PAGINA = 100;
  for (let da = 0; ; da += PAGINA) {
    const { data, error } = await deposito.from(contenitore).list(dentro, { limit: PAGINA, offset: da });
    if (error || !data?.length) break;
    for (const o of data as Oggetto[]) {
      const nome = String(o?.name || "");
      if (!nome) continue;
      const percorso = dentro ? `${dentro}/${nome}` : nome;
      //  Una cartella non ha id: dentro ci si entra.
      if (!o.id) out.push(...(await tuttiGliOggetti(contenitore, percorso, profondita + 1)));
      else out.push({ percorso, byte: Number(o.metadata?.size || 0), quando: String(o.updated_at || "") });
    }
    if (data.length < PAGINA) break;
  }
  return out;
}

export const Route = createFileRoute("/api/crm/sorgente")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        const q = new URL(request.url).searchParams;

        /*  ── L'ELENCO DEI FILE CARICATI ──────────────────────────────────
            Non si spostano i file DENTRO questa risposta: le registrazioni da
            sole sono gigabyte, e farle passare di qui vorrebbe dire una
            richiesta che non finisce mai. Si consegna l'elenco con un
            collegamento per ciascuno, e chi porta via i dati li scarica con
            due righe di comando (sono nel foglio delle istruzioni). */
        if (q.get("file")) {
          const contenitori: Record<string, unknown> = {};
          let quanti = 0;
          let byte = 0;
          for (const c of CONTENITORI_FILE) {
            const oggetti = await tuttiGliOggetti(c.nome).catch(() => []);
            if (!oggetti.length) continue;
            const con = await Promise.all(
              oggetti.map(async (o) => {
                const { data } = await deposito.from(c.nome).createSignedUrl(o.percorso, DURATA_COLLEGAMENTO);
                return { ...o, url: data?.signedUrl || "" };
              }),
            );
            quanti += con.length;
            byte += con.reduce((t, o) => t + o.byte, 0);
            contenitori[c.nome] = { cosa: c.cosa, quanti: con.length, file: con };
          }
          return json({
            ok: true,
            quando: new Date().toISOString(),
            scadenzaCollegamenti: `${DURATA_COLLEGAMENTO / 60} minuti`,
            quanti,
            byte,
            contenitori,
          });
        }

        /*  ── LA SORGENTE DEL PROGRAMMA ───────────────────────────────────
            La riga `sorgente_ultima` dice qual è l'ultima depositata: si legge
            quella invece di elencare il contenitore, che costa di più e può
            rispondere in un ordine che non è quello giusto. */
        const { data: riga } = await supabaseAdmin
          .from("app_config").select("value").eq("key", CHIAVE_ULTIMA).maybeSingle();
        let ultima: { nome?: string; byte?: number; commit?: string; ramo?: string; quando?: string } = {};
        try { ultima = JSON.parse((riga as { value?: string } | null)?.value || "{}"); } catch { /* riga storta */ }
        if (!ultima?.nome)
          return json({
            ok: false,
            reason:
              "la sorgente non è ancora stata depositata: si deposita da sola alla prossima pubblicazione del programma",
          }, 404);

        const { data, error } = await deposito
          .from(CONTENITORE)
          .createSignedUrl(ultima.nome, DURATA_COLLEGAMENTO, { download: ultima.nome });
        if (error || !data?.signedUrl)
          return json({ ok: false, reason: error?.message || "collegamento non creato" }, 500);

        return json({
          ok: true,
          url: data.signedUrl,
          nome: ultima.nome,
          byte: ultima.byte || 0,
          commit: ultima.commit || "",
          ramo: ultima.ramo || "",
          quando: ultima.quando || "",
          scadenzaCollegamento: `${DURATA_COLLEGAMENTO / 60} minuti`,
        });
      },
    },
  },
});
