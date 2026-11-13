/** ── FATTURE DALLA CHAT · T13 · SELEZIONE DELLE BOLLE (VIA 2) ────────────────
 *  PIANO §2bis/§4 (T13), SPEC §9.3 passo 2, §9.4, §9.6: `selezionabileFattura`
 *  e `commutaFattura`, stesso schema minimo di `risposte-ai/rispiega.ts`
 *  (`selezionabile`/`commuta`) ma SCRITTO DI NUOVO, non importato — zero
 *  coupling fra le due selezioni (§0bis.1: un bug qui non deve poter rompere
 *  «Rispiega con AI»). Per le immagini si riusa invece `mediaDelPonte`
 *  (`chatwa/usaMediaPonte.ts`), per import, non copia.
 *
 *  `selezione-fattura.ts` non è ancora nell'elenco `MODULI` di prove/prove.mjs
 *  (resta di T0): si impacchetta QUI con esbuild, stesso schema di T1/T12.
 *  `usaMediaPonte.ts` importa `react`/`@/integrations/supabase/client`/
 *  `@/crm/AuthContext`: per bundlarlo senza una rete vera si redirigono quei
 *  due import a due stub minimi (stesso trucco già usato da
 *  `prove/ponte/media-chat-ui.mjs`), `react` si risolve da solo (è un
 *  pacchetto vero in `node_modules`, non serve DOM per importarlo). */
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function impacchetta(radice, percorso) {
  const esbuild = createRequire(import.meta.url)("esbuild");
  const dir = mkdtempSync(join(tmpdir(), "selezione-fattura-"));
  try {
    writeFileSync(join(dir, "client.js"), "export const supabase = {};");
    writeFileSync(join(dir, "auth.js"), "export const fetchCRM = async () => new Response('{}');");
    const risultato = await esbuild.build({
      entryPoints: [join(radice, percorso)],
      bundle: true,
      format: "esm",
      platform: "node",
      write: false,
      logLevel: "silent",
      alias: { "@": join(radice, "src") },
      plugins: [
        {
          name: "rete-finta",
          setup(b) {
            b.onResolve({ filter: /^@\/integrations\/supabase\/client$/ }, () => ({
              path: join(dir, "client.js"),
            }));
            b.onResolve({ filter: /^@\/crm\/AuthContext$/ }, () => ({
              path: join(dir, "auth.js"),
            }));
          },
        },
      ],
    });
    const testo = risultato.outputFiles[0].text;
    return await import(`data:text/javascript;base64,${Buffer.from(testo).toString("base64")}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const baileys = (id, body, chiave = "bw:393330001111:3EB0A1B2C3D4") => ({
  id,
  canale: "baileys",
  wa_message_id: chiave,
  body,
});

export async function prove(_mod, { c, gruppo, radice }) {
  const K = await impacchetta(radice, "src/crm/fatture/dalla-chat/selezione-fattura.ts");

  gruppo("DALLA CHAT · T13 · selezionabileFattura: testo");
  c(
    "testo vero, da noi o dal cliente → selezionabile (il server decide se usarlo, non questo file)",
    [true, true],
    [
      K.selezionabileFattura({ id: "a", canale: "manychat", body: "Via Roma 1, 00100 Roma" }),
      K.selezionabileFattura({ id: "b", canale: "baileys", body: "Il mio CF è RSSMRA80A01H501Z" }),
    ],
  );
  c(
    "vuota, solo spazi o senza testo → no",
    [false, false, false],
    [
      K.selezionabileFattura({ id: "a", body: null }),
      K.selezionabileFattura({ id: "b", body: "   \n" }),
      K.selezionabileFattura({ id: "c", body: "[messaggio senza testo]" }),
    ],
  );
  c(
    "un modello salvato «[template:nome]» → no (non è ciò che ha scritto il cliente)",
    false,
    K.selezionabileFattura({ id: "a", body: "[template:promemoria]" }),
  );

  gruppo("DALLA CHAT · T13 · selezionabileFattura: immagini (mediaDelPonte, import non copia)");
  c(
    "una bolla-immagine del ponte (Baileys) → selezionabile, anche come segnaposto non scaricato",
    [true, true],
    [
      K.selezionabileFattura(baileys("a", "📷 Foto")),
      K.selezionabileFattura(baileys("b", "📷 Foto: tessera sanitaria")),
    ],
  );
  c(
    "un vocale o un video del ponte → sono media del ponte, quindi selezionabili anche loro",
    [true, true],
    [
      K.selezionabileFattura(baileys("a", "🎤 Vocale")),
      K.selezionabileFattura(baileys("b", "🎥 Video")),
    ],
  );
  c(
    "sticker/reazione (nessun testo, nessuna chiave del ponte) → no",
    false,
    K.selezionabileFattura({ id: "a", canale: "baileys", body: "[messaggio senza testo]" }),
  );

  gruppo(
    "DALLA CHAT · T13 · commutaFattura: stesso schema di commuta in rispiega.ts, duplicato apposta",
  );
  c("un tocco aggiunge in fondo", ["a", "b"], K.commutaFattura(["a"], "b"));
  c("un secondo tocco la toglie", ["a"], K.commutaFattura(["a", "b"], "b"));
  c("il tetto MAX_BOLLE_FATTURA è 10", 10, K.MAX_BOLLE_FATTURA);
  {
    let scelti = [];
    for (let i = 0; i < 12; i++) scelti = K.commutaFattura(scelti, `m${i}`);
    c("un'undicesima bolla non si aggiunge: il tetto resta a 10", 10, scelti.length);
    c(
      "le prime 10 sono quelle rimaste (nessuna sostituzione delle vecchie)",
      Array.from({ length: 10 }, (_, i) => `m${i}`),
      scelti,
    );
  }

  gruppo("DALLA CHAT · T13 · nessun coupling con risposte-ai/rispiega.ts");
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(join(radice, "src/crm/fatture/dalla-chat/selezione-fattura.ts"), "utf8");
  const righeImport = src.split("\n").filter((riga) => /^\s*import\b/.test(riga));
  c(
    "nessuna riga IMPORT riferisce risposte-ai/rispiega: la selezione è scritta di nuovo, non importata",
    false,
    righeImport.some((r) => /risposte-ai\/rispiega/.test(r)),
  );
}
