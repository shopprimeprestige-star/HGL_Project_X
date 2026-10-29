/** ── PROVE: L'AVVISO «IL PONTE È FERMO» ──
 *
 *  File d'area della commessa 2026-10-29-ponte-whatsapp-baileys, compito T8.
 *  Prova la regola pura (`src/crm/chatwa/avvisoPonte.ts`), la fascia disegnata
 *  (`StatoPonte.tsx`, con una lettura finta al posto del database) e la
 *  lettura (`usaStatoPonte.ts`, dal sorgente). Dati inventati: nessun numero né
 *  nome vero, nessuna rete.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Parole che il titolare non deve mai leggere in un avviso. */
const VIETATE = /\b(QR|Baileys|token|JID|LID|sessione|battito|server|database|API|socket|log)\b/i;

export async function provePonteBanner(mod, { c, gruppo, radice }) {
  gruppo("PONTE WHATSAPP · L'AVVISO «IL PONTE È FERMO» (compito T8)");
  const esbuild = createRequire(import.meta.url)("esbuild");
  const dir = mkdtempSync(join(tmpdir(), "ponte-banner-"));
  try {
    //  La regola pura, impacchettata a parte (non è in MODULI di prove.mjs).
    const fuoriRegola = join(dir, "avvisoPonte.cjs");
    await esbuild.build({
      entryPoints: [join(radice, "src/crm/chatwa/avvisoPonte.ts")],
      bundle: true,
      format: "cjs",
      platform: "node",
      outfile: fuoriRegola,
      logLevel: "error",
      alias: { "@": join(radice, "src") },
    });
    const richiedi = createRequire(import.meta.url);
    const R = richiedi(fuoriRegola);

    const ADESSO = new Date("2026-10-29T12:00:00.000Z");
    const fa = (ms) => new Date(ADESSO.getTime() - ms).toISOString();
    const MIN = 60_000;
    const riga = (stato, ms = 10_000, storico = null) => ({
      stato,
      aggiornato_il: fa(ms),
      storico,
    });
    const A = (r, adesso = ADESSO) => R.avvisoPonte(r, adesso);

    // ── a) Quando NON si mostra niente ──────────────────────────────────
    const niente = { mostra: false, gravita: "nessuna", frase: "" };
    c("riga assente: nessun avviso (il CRM di oggi resta identico)", niente, A(null));
    c("collegato e battito fresco: nessun avviso", niente, A(riga("collegato")));
    c(
      "collegato con lo storico finito: nessun avviso",
      niente,
      A(riga("collegato", 5_000, { fatto: 1, avanzamento: 100 })),
    );
    c(
      "collegato senza informazioni sullo storico: nessun avviso",
      niente,
      A(riga("collegato", 5_000, {})),
    );
    c(
      "data illeggibile: nessun avviso (meglio niente di uno sbagliato)",
      niente,
      A({ stato: "fermo", aggiornato_il: "non-una-data" }),
    );
    c("ora di adesso illeggibile: nessun avviso", niente, A(riga("fermo"), new Date("x")));

    // ── b) La soglia dei 3 minuti ───────────────────────────────────────
    c("battito di 3 minuti esatti: ancora fresco", niente, A(riga("collegato", 3 * MIN)));
    const fermo = A(riga("collegato", 3 * MIN + 1000));
    c(
      "battito di poco oltre 3 minuti: «non risponde», grave",
      [true, "grave", true],
      [fermo.mostra, fermo.gravita, /non risponde da 3 minuti/.test(fermo.frase)],
    );
    c(
      "la frase del silenzio dice cosa fare e cosa non arriva",
      [true, true],
      [
        /12 minuti/.test(A(riga("collegato", 12 * MIN)).frase),
        /Controlla che il Mac sia acceso/.test(A(riga("collegato", 12 * MIN)).frase),
      ],
    );
    c("durata in ore", true, /da 2 ore:/.test(A(riga("collegato", 2 * 60 * MIN + 5 * MIN)).frase));
    c("durata in un'ora sola", true, /da 1 ora:/.test(A(riga("collegato", 61 * MIN)).frase));
    c(
      "durata in giorni",
      true,
      /da 3 giorni:/.test(A(riga("collegato", 3 * 24 * 60 * MIN + MIN)).frase),
    );
    c(
      "durata in un giorno solo",
      true,
      /da 1 giorno:/.test(A(riga("collegato", 25 * 60 * MIN)).frase),
    );
    c(
      "il silenzio vince su uno stato vecchio (scollegato ma Mac spento → non risponde)",
      true,
      /non risponde/.test(A(riga("sessione_scaduta", 20 * MIN)).frase),
    );
    c(
      "il silenzio vince anche su «fermo»",
      true,
      /non risponde/.test(A(riga("fermo", 20 * MIN)).frase),
    );

    // ── c) Orologio indietro ────────────────────────────────────────────
    c(
      "battito «dal futuro» (orologio indietro): si considera fresco",
      niente,
      A(riga("collegato", -10 * MIN)),
    );
    c(
      "battito «dal futuro» con stato che non va: segue lo stato, non il silenzio",
      true,
      /scollegato/.test(A(riga("sessione_scaduta", -10 * MIN)).frase),
    );

    // ── d) Tutti gli stati ──────────────────────────────────────────────
    const { STATI_PONTE } = mod["ponte/tipi"];
    const attesi = {
      collegato: [false, "nessuna"],
      in_collegamento: [true, "attenzione"],
      attesa_qr: [true, "grave"],
      sessione_scaduta: [true, "grave"],
      sostituita: [true, "attenzione"],
      rete_assente: [true, "attenzione"],
      coda_piena: [true, "info"],
      errore: [true, "grave"],
      fermo: [true, "grave"],
    };
    c(
      "la prova copre esattamente gli stati del ponte",
      [...STATI_PONTE].sort(),
      Object.keys(attesi).sort(),
    );
    for (const [stato, [mostra, gravita]] of Object.entries(attesi)) {
      const a = A(riga(stato));
      c(
        `stato ${stato}: mostra e gravità`,
        [mostra, gravita, mostra],
        [a.mostra, a.gravita, a.frase.length > 0],
      );
    }
    const scollegato = A(riga("sessione_scaduta")).frase;
    c(
      "scollegato: dice come ricollegare, passo per passo",
      [true, true, true, true],
      [
        /scollegato il ponte/.test(scollegato),
        /codice da inquadrare/.test(scollegato),
        /WhatsApp Business/.test(scollegato),
        /Dispositivi collegati/.test(scollegato),
      ],
    );
    c(
      "in attesa del codice dice la stessa cosa dello scollegato",
      scollegato,
      A(riga("attesa_qr")).frase,
    );
    c("stato fuori lista: letto come errore", A(riga("errore")), A(riga("boh")));

    // ── e) Lo storico ancora in arrivo ──────────────────────────────────
    const arrivo = A(riga("collegato", 5_000, { fatto: 0, avanzamento: 62 }));
    c(
      "storico in arrivo: informativa discreta con la percentuale",
      [true, "info", "Il ponte è collegato ma lo storico è ancora in arrivo (62%)."],
      [arrivo.mostra, arrivo.gravita, arrivo.frase],
    );
    c(
      "storico in arrivo, percentuale con decimali: per difetto",
      true,
      /\(62%\)/.test(A(riga("collegato", 5_000, { fatto: 0, avanzamento: 62.9 })).frase),
    );
    c(
      "storico a zero: 0%",
      true,
      /\(0%\)/.test(A(riga("collegato", 5_000, { fatto: 0, avanzamento: 0 })).frase),
    );
    c(
      "storico «fatto 0» ma al 100%: niente",
      niente,
      A(riga("collegato", 5_000, { fatto: 0, avanzamento: 100 })),
    );
    c(
      "avanzamento negativo: 0%",
      true,
      /\(0%\)/.test(A(riga("collegato", 5_000, { fatto: 0, avanzamento: -5 })).frase),
    );
    c(
      "storico con numeri strani: niente",
      niente,
      A(riga("collegato", 5_000, { fatto: 0, avanzamento: NaN })),
    );

    // ── f) Nessuna parola tecnica, nessun dato dei clienti ──────────────
    const tutte = [
      ...Object.keys(attesi).map((s) => A(riga(s)).frase),
      A(riga("collegato", 12 * MIN)).frase,
      A(riga("collegato", 5 * 60 * MIN)).frase,
      arrivo.frase,
    ].filter(Boolean);
    c("ci sono tutte le frasi da controllare", true, tutte.length >= 9);
    for (const f of tutte) {
      c(`frase senza parole tecniche: «${f.slice(0, 48)}…»`, null, f.match(VIETATE)?.[0] ?? null);
    }
    c(
      "nessuna frase contiene cifre lunghe (numeri di telefono) o chiocciole",
      true,
      tutte.every((f) => !/\d{6,}|@/.test(f)),
    );
    c(
      "ogni frase finisce con un punto",
      true,
      tutte.every((f) => f.endsWith(".")),
    );
    c(
      "le frasi sono scritte in italiano semplice, brevi (≤ 230 caratteri)",
      true,
      tutte.every((f) => f.length <= 230),
    );

    // ── g) La fascia disegnata, con avvisi finti ────────────────────────
    const finto = join(dir, "usa-finto.mjs");
    writeFileSync(finto, `export function useStatoPonte() { return globalThis.__avvisoFinto; }`);
    //  Un solo pacchetto con React dentro: la fascia, React e il disegno su testo.
    const ingresso = join(dir, "fascia-ingresso.tsx");
    writeFileSync(
      ingresso,
      `import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
export { React, renderToStaticMarkup };
export { StatoPonte, FasciaPonte } from ${JSON.stringify(join(radice, "src/crm/chatwa/StatoPonte.tsx"))};`,
    );
    const fuoriFascia = join(dir, "fascia.cjs");
    await esbuild.build({
      entryPoints: [ingresso],
      nodePaths: [join(radice, "node_modules")],
      bundle: true,
      format: "cjs",
      platform: "node",
      outfile: fuoriFascia,
      logLevel: "error",
      loader: { ".tsx": "tsx" },
      jsx: "automatic",
      alias: { "@": join(radice, "src") },
      plugins: [
        {
          name: "lettura-finta",
          setup(b) {
            b.onResolve({ filter: /\/usaStatoPonte$/ }, () => ({ path: finto }));
          },
        },
      ],
    });
    const { StatoPonte, FasciaPonte, React, renderToStaticMarkup } = richiedi(fuoriFascia);
    const html = (avviso) => {
      globalThis.__avvisoFinto = avviso;
      return renderToStaticMarkup(React.createElement(StatoPonte));
    };
    c("fascia: nessun avviso → non disegna niente (nemmeno un div vuoto)", "", html(niente));
    for (const [stato, gravita] of [
      ["fermo", "grave"],
      ["in_collegamento", "attenzione"],
      ["coda_piena", "info"],
    ]) {
      const a = A(riga(stato));
      const h = html(a);
      c(
        `fascia ${stato}: role=status, gravità, frase intera`,
        [true, true, true],
        [
          h.includes('role="status"'),
          h.includes(`data-gravita="${gravita}"`),
          h.includes(a.frase.replace(/'/g, "&#x27;")),
        ],
      );
    }
    const hGrave = html(A(riga("fermo")));
    const hInfo = html(A(riga("coda_piena")));
    c(
      "fascia: l'icona c'è ed è nascosta ai lettori di schermo (il significato è nella frase)",
      [true, true],
      [hGrave.includes("<svg") && hGrave.includes('aria-hidden="true"'), hInfo.includes("<svg")],
    );
    c(
      "fascia: grave e info non usano la stessa icona (non solo il colore)",
      true,
      hGrave.match(/<svg[^>]*class="([^"]*)"/)?.[1] !== undefined &&
        hGrave.match(/lucide-([a-z-]+)/)?.[1] !== hInfo.match(/lucide-([a-z-]+)/)?.[1],
    );
    c(
      "fascia: il testo va a capo sul telefono (niente truncate né whitespace-nowrap)",
      false,
      /truncate|nowrap/.test(hGrave),
    );
    c(
      "FasciaPonte è esportata e non disegna un avviso «nessuna»",
      "",
      renderToStaticMarkup(
        React.createElement(FasciaPonte, {
          avviso: { mostra: true, gravita: "nessuna", frase: "x" },
        }),
      ),
    );

    // ── h) La lettura (dal sorgente) ────────────────────────────────────
    const hook = readFileSync(join(radice, "src/crm/chatwa/usaStatoPonte.ts"), "utf8");
    const codice = hook.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    c(
      "la lettura chiede la tabella giusta, per l'utente, con tre colonne",
      [true, true, true],
      [
        codice.includes('.from("ponte_wa_stato")'),
        codice.includes('.select("stato,aggiornato_il,storico")'),
        codice.includes('.eq("user_id", userId)'),
      ],
    );
    c(
      "la lettura: una al minuto, al ritorno sulla pagina, mai a scheda nascosta, nessun realtime",
      [true, true, true, false],
      [
        codice.includes("60_000"),
        codice.includes('"visibilitychange"'),
        codice.includes('=== "hidden"'),
        /channel|postgres_changes|subscribe/.test(codice),
      ],
    );
    c(
      "la lettura non scrive nei log e non lancia errori a schermo",
      [false, true],
      [/console\./.test(codice), /try\s*\{[\s\S]*catch/.test(codice)],
    );
    c(
      "con un errore l'avviso si toglie (non resta uno vecchio)",
      true,
      /let nuovo = NIENTE;[\s\S]*if \(!error\) nuovo = avvisoPonte/.test(codice),
    );

    // ── i) Il punto di montaggio ────────────────────────────────────────
    const pagina = readFileSync(join(radice, "src/crm/chatwa/PaginaChat.tsx"), "utf8");
    c(
      "PaginaChat monta l'avviso una volta sola",
      [1, 1],
      [
        (pagina.match(/<StatoPonte \/>/g) ?? []).length,
        (pagina.match(/import \{ StatoPonte \}/g) ?? []).length,
      ],
    );
    c(
      "l'avviso sta prima dell'errore di lettura, fuori dalle viste",
      true,
      pagina.indexOf("<StatoPonte />") < pagina.indexOf("{api.erroreLettura && ("),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
