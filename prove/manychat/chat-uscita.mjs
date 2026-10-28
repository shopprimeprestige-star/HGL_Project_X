/** ── PROVE: CHAT WHATSAPP · L'USCITA ─────────────────────────────────────────────
 *
 *  Commessa 2026-10-28 (chat WhatsApp nel CRM), PIANO.md T5.
 *  Cosa copre: quando il messaggio dal CRM è partito davvero (ManyChat `ok`) il
 *  cliente esce da «Da rispondere» (`whatsapp_segna_risposto`), e la rotta del
 *  canale è aperta a chi lavora i lead (`lead.propri`).
 *
 *  ⚠️ NIENTE DI VERO: `porta.server.ts` è quello vero ma col Supabase finto; le
 *   due rotte si leggono come testo (non si possono avviare senza TanStack e
 *   senza sessione), come fa `porta.mjs` per le reti di sicurezza.
 *  ⚠️ «non lancia mai» e «una volta per processo» (PIANO D6/[R12]): il modulo si
 *   ricarica da capo a ogni scenario, perché la memoria dell'avviso sta lì.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

export async function proveChatUscita(mod, { c, gruppo, radice }) {
  const U = "utente-uscita-1";
  const TEL = "+393331234567";

  /* ════════════════════════════════════════════════════════════════════════
   *  1 · `segnaRispostoDalCrm`: la porta vera, il database finto
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("CHAT WHATSAPP · USCITA · SEGNA «RISPOSTO» (porta.server vero, database finto)");
  const dir = mkdtempSync(join(tmpdir(), "chat-uscita-"));
  const avvisi = [];
  const avvisoOriginale = console.warn;
  try {
    const finta = join(dir, "supabase-finto.js");
    writeFileSync(
      finta,
      `export const supabaseAdmin = {
  rpc: async (fn, args) => {
    globalThis.__rpc.chiamate.push({ fn, args });
    return globalThis.__rpc.risposta(fn, args);
  },
};
export const supabaseAdminDefault = supabaseAdmin;`,
    );
    const esbuild = createRequire(import.meta.url)("esbuild");
    const fuori = join(dir, "porta-server.cjs");
    await esbuild.build({
      entryPoints: [join(radice, "src/crm/manychat/porta.server.ts")],
      bundle: true,
      format: "cjs",
      platform: "node",
      outfile: fuori,
      logLevel: "error",
      alias: { "@/integrations/supabase/client.server": finta, "@": join(radice, "src") },
    });
    const richiedi = createRequire(import.meta.url);
    /** Modulo nuovo di zecca (memoria dell'avviso azzerata) + database finto con la risposta data. */
    const carica = (risposta) => {
      delete richiedi.cache[richiedi.resolve(fuori)];
      globalThis.__rpc = { chiamate: [], risposta };
      avvisi.length = 0;
      console.warn = (...a) => avvisi.push(a.map(String).join(" "));
      return richiedi(fuori);
    };

    // a) Tutto bene: chiama la funzione giusta, con l'utente e il numero.
    {
      const PS = carica(async () => ({ data: true, error: null }));
      const ok = await PS.segnaRispostoDalCrm(U, TEL);
      c(
        "chiama whatsapp_segna_risposto con p_user_id e p_phone, una volta",
        [[{ fn: "whatsapp_segna_risposto", args: { p_user_id: U, p_phone: TEL } }], true, 0],
        [globalThis.__rpc.chiamate, ok, avvisi.length],
      );
    }

    // b) Funzione mancante (prima della migrazione): non lancia, UN avviso solo, anche a ripetizione.
    for (const codice of ["42883", "PGRST202"]) {
      const PS = carica(async () => ({ data: null, error: { code: codice, message: `function ${TEL}` } }));
      let lanciato = null;
      let esiti;
      try {
        esiti = [await PS.segnaRispostoDalCrm(U, TEL), await PS.segnaRispostoDalCrm(U, TEL)];
      } catch (e) {
        lanciato = String(e);
      }
      c(
        `funzione mancante (${codice}): non lancia e non dice "fatto"`,
        [null, [false, false]],
        [lanciato, esiti],
      );
      c(
        `funzione mancante (${codice}): un solo avviso per processo, col solo codice`,
        [1, true, false, false],
        [
          avvisi.length,
          avvisi[0]?.includes(codice),
          /393331234567/.test(avvisi.join("|")),
          /function/.test(avvisi.join("|")),
        ],
      );
    }

    // c) Un altro errore del database: non lancia, avviso col solo codice (mai numero né messaggio).
    {
      const PS = carica(async () => ({ data: null, error: { code: "XX000", message: `boom ${TEL}` } }));
      let lanciato = null;
      let ok;
      try {
        ok = await PS.segnaRispostoDalCrm(U, TEL);
      } catch (e) {
        lanciato = String(e);
      }
      c(
        "altro errore del database: non lancia, un avviso con il solo codice",
        [null, false, 1, true, false],
        [lanciato, ok, avvisi.length, avvisi[0]?.includes("XX000"), /393331234567|boom/.test(avvisi.join("|"))],
      );
    }

    // d) La chiamata stessa lancia (rete, eccezione con dentro il numero): non lancia, niente numero nei log.
    {
      const PS = carica(async () => {
        throw new Error(`rete giù per ${TEL}`);
      });
      let lanciato = null;
      let ok;
      try {
        ok = await PS.segnaRispostoDalCrm(U, TEL);
      } catch (e) {
        lanciato = String(e);
      }
      c(
        "la chiamata che lancia: non lancia fuori, un avviso, niente numero né messaggio dell'errore",
        [null, false, 1, false],
        [lanciato, ok, avvisi.length, /393331234567|rete/.test(avvisi.join("|"))],
      );
    }
  } finally {
    console.warn = avvisoOriginale;
    delete globalThis.__rpc;
    rmSync(dir, { recursive: true, force: true });
  }

  /* ════════════════════════════════════════════════════════════════════════
   *  2 · `api.whatsapp-send.ts`: dove sta la chiamata
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("CHAT WHATSAPP · USCITA · LA ROTTA DI INVIO SEGNA «RISPOSTO» SOLO DOPO UN `ok` DI MANYCHAT");
  {
    const invio = senzaCommenti(readFileSync(join(radice, "src/routes/api.whatsapp-send.ts"), "utf8"));
    const chiamate = [...invio.matchAll(/segnaRispostoDalCrm\(/g)].map((m) => m.index);
    const ramoManychat = invio.indexOf('canale.canale === "manychat"');
    const rispostaManychat = invio.indexOf("rispostaChat(r)");
    const ramoGraph = invio.indexOf('from("whatsapp_settings")');
    const dopoOk = invio.slice(0, chiamate[0] ?? 0).lastIndexOf('r.esito !== "ok"');
    c(
      "la chiamata compare una sola volta, e il file la importa da porta.server",
      [1, true],
      [chiamate.length, /import \{[^}]*segnaRispostoDalCrm[^}]*\} from "@\/crm\/manychat\/porta\.server"/.test(invio)],
    );
    c(
      "…dentro il ramo ManyChat: dopo il controllo dell'esito, prima della risposta e prima del ramo Graph",
      true,
      ramoManychat >= 0 &&
        dopoOk > ramoManychat &&
        chiamate[0] > dopoOk &&
        chiamate[0] < rispostaManychat &&
        rispostaManychat < ramoGraph,
    );
    c(
      "…solo quando l'esito è ok: sta nel `else` del controllo `esito !== \"ok\"`, non lo precede",
      true,
      /if \(r\.esito !== "ok"\)[^;]*;\s*else\s+await segnaRispostoDalCrm\(userId, to\)/.test(invio),
    );
    c(
      "il ramo Graph (Cloud) non la chiama",
      false,
      invio.slice(ramoGraph).includes("segnaRispostoDalCrm"),
    );
    const chiamataInvio = invio.slice(invio.indexOf("inviaWhatsapp("), invio.indexOf("rispostaChat(r)"));
    c(
      "il testo libero passa ancora con tipo «chat» e senza chiave (porta unica, nessuna chiave di idempotenza)",
      [true, false],
      [/tipo: "chat"/.test(chiamataInvio), /\bchiave\b/.test(chiamataInvio)],
    );
    c(
      "l'esito dell'invio non cambia per chi chiama: la risposta resta quella di rispostaChat",
      true,
      /const \{ status, corpo \} = rispostaChat\(r\);\s*return Response\.json\(corpo, \{ status \}\)/.test(invio),
    );
  }

  /* ════════════════════════════════════════════════════════════════════════
   *  3 · La frase fuori finestra e il 429 restano quelli di prima
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("CHAT WHATSAPP · USCITA · FUORI FINESTRA E PAUSA (nessun cambio in porta.ts)");
  {
    const { rispostaChat } = mod["manychat/porta"];
    const f = rispostaChat({ esito: "blocco", codice: "fuori_24h" });
    c(
      "fuori 24 ore → 502 wa_api_error, category outside_24h_window (la pagina sceglie i modelli)",
      [502, "wa_api_error", "outside_24h_window"],
      [f.status, f.corpo.error, f.corpo.category],
    );
    const p = rispostaChat({ esito: "riprova_fra_poco" });
    c(
      "pausa → 429 riprova_fra_poco (la pagina lo mostra come «Un attimo, riprova»)",
      [429, "riprova_fra_poco"],
      [p.status, p.corpo.error],
    );
  }

  /* ════════════════════════════════════════════════════════════════════════
   *  4 · La rotta del canale: permesso `lead.propri`, niente di segreto
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("CHAT WHATSAPP · USCITA · LA ROTTA DEL CANALE È PER CHI LAVORA I LEAD");
  {
    const grezza = readFileSync(join(radice, "src/routes/api.crm.whatsapp-canale.ts"), "utf8");
    const rotta = senzaCommenti(grezza);
    c(
      "la guardia è guardiaCRM(…, \"lead.propri\"), una volta sola",
      1,
      (rotta.match(/guardiaCRM\(request, cors, "lead\.propri"\)/g) ?? []).length,
    );
    c(
      "il permesso «impostazioni» non compare più nel codice della rotta",
      false,
      /impostazioni/.test(rotta),
    );
    c(
      "la testata dice il permesso giusto (niente «impostazioni» che farebbe credere il contrario)",
      [true, false],
      [/lead\.propri/.test(grezza.slice(0, grezza.indexOf("import "))), /COL PERMESSO «impostazioni»/.test(grezza)],
    );
    c(
      "senza titolare dei dati risponde ancora 403, e il guasto del canale 503",
      [true, true],
      [/adminUserId\)[^;]*json\(\{ ok: false, error: "titolare" \}, 403\)/.test(rotta), /canale_non_leggibile[^;]*503/.test(rotta)],
    );

    // Cosa esce davvero: lo stato del canale con una chiave ManyChat e flussi pieni.
    const { statoCanaleDaRiga } = mod["prova-modelli"];
    const stato = statoCanaleDaRiga(
      {
        data: { canale: "manychat", flussi: { hgl_meet_oggi: "content-segretissimo-123", hgl_vuoto: "  " } },
        error: null,
      },
      true,
    );
    c(
      "la risposta espone solo canale, nomi dei modelli con flusso e due booleani",
      [["canale", "chiaveManychat", "migrazione", "modelliConFlusso"], ["hgl_meet_oggi"], false],
      [Object.keys(stato).sort(), stato.modelliConFlusso, JSON.stringify(stato).includes("segretissimo")],
    );
    c(
      "la rotta spande solo `ok` e lo stato, nient'altro",
      true,
      /json\(\{ ok: true, \.\.\.stato \}\)/.test(rotta),
    );
  }
}
