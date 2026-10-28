/** ── PROVE: CHAT WHATSAPP · DETTATURA (VOCE → TESTO NELLA CASELLA) ─────────────
 *
 *  Commessa 2026-10-28-chat-dettatura. Le regole pure di
 *  `src/crm/chatwa/dettatura.ts`: il formato dal mimeType, i limiti (durata e
 *  dimensione), la pulizia della risposta di OpenRouter, le frasi d'errore e il
 *  testo aggiunto alla bozza. Più i controlli sul sorgente: la route dietro la
 *  guardia del CRM, niente audio né testo nei log, nessun invio di vocali.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function proveChatDettatura(mod, { c, gruppo, radice }) {
  const D = mod["chatwa/dettatura"];

  gruppo("CHAT · DETTATURA · IL FORMATO DAL MIMETYPE");
  c("iPhone (audio/mp4): m4a", "m4a", D.formatoDaMime("audio/mp4"));
  c("Chrome (audio/webm;codecs=opus): webm", "webm", D.formatoDaMime("audio/webm;codecs=opus"));
  c("maiuscole e spazi non contano", "webm", D.formatoDaMime(" Audio/WebM ; codecs=opus"));
  c("Firefox (audio/ogg;codecs=opus): ogg", "ogg", D.formatoDaMime("audio/ogg;codecs=opus"));
  c("altri noti: m4a, mp3, wav, aac", ["m4a", "mp3", "wav", "aac"],
    ["audio/x-m4a", "audio/mpeg", "audio/wav", "audio/aac"].map(D.formatoDaMime));
  c("video/webm (qualche Chrome lo dà): webm", "webm", D.formatoDaMime("video/webm"));
  c("vuoto o sconosciuto: niente", [null, null, null], ["", "text/plain", "audio/flac-strano"].map(D.formatoDaMime));

  gruppo("CHAT · DETTATURA · CHE COSA CHIEDERE AL REGISTRATORE");
  const solo = (ok) => (t) => ok.includes(t);
  c("Chrome: webm/opus", "audio/webm;codecs=opus", D.mimeDaRegistrare(solo(["audio/webm;codecs=opus", "audio/webm"])));
  c("Safari iPhone: mp4", "audio/mp4", D.mimeDaRegistrare(solo(["audio/mp4"])));
  c("nessuno dei nostri: decide il browser (stringa vuota)", "", D.mimeDaRegistrare(() => false));
  c("isTypeSupported che lancia: decide il browser", "", D.mimeDaRegistrare(() => { throw new Error("x"); }));

  gruppo("CHAT · DETTATURA · I LIMITI");
  c("2 minuti, ~10 MB", [120000, 10 * 1024 * 1024], [D.DURATA_MAX_MS, D.BYTE_MAX]);
  c("audio buono", null, D.erroreAudio({ byte: 50000, formato: "m4a", durataMs: 5000 }));
  c("vuoto", "audio_vuoto", D.erroreAudio({ byte: 0, formato: "m4a", durataMs: 5000 }));
  c("troppo piccolo per essere parlato (< 1 KB)", "audio_vuoto", D.erroreAudio({ byte: 500, formato: "webm", durataMs: 5000 }));
  c("oltre 10 MB", "troppo_grande", D.erroreAudio({ byte: D.BYTE_MAX + 1, formato: "m4a", durataMs: 5000 }));
  c("esattamente 10 MB passa", null, D.erroreAudio({ byte: D.BYTE_MAX, formato: "m4a", durataMs: 5000 }));
  c("formato sconosciuto", "formato", D.erroreAudio({ byte: 50000, formato: null, durataMs: 5000 }));
  c("oltre 2 minuti (con 5 s di tolleranza per il ritardo del registratore)", ["troppo_lungo", null], [
    D.erroreAudio({ byte: 50000, formato: "m4a", durataMs: D.DURATA_MAX_MS + 5001 }),
    D.erroreAudio({ byte: 50000, formato: "m4a", durataMs: D.DURATA_MAX_MS + 5000 }),
  ]);
  c("durata mancante o assurda: rifiutata", ["durata", "durata", "durata"], [NaN, -1, Infinity].map((durataMs) =>
    D.erroreAudio({ byte: 50000, formato: "m4a", durataMs })));
  c("la dimensione si guarda prima di tutto il resto", "troppo_grande",
    D.erroreAudio({ byte: D.BYTE_MAX * 2, formato: null, durataMs: NaN }));

  gruppo("CHAT · DETTATURA · DA BYTE A BASE64 (SENZA DATA URI)");
  const enc = (s) => new TextEncoder().encode(s);
  c("come Buffer", Buffer.from("Ciao, è una prova").toString("base64"), D.base64DaByte(enc("Ciao, è una prova")));
  const grande = new Uint8Array(200000).map((_, i) => (i * 7) % 256);
  c("a pezzi su un audio grande (niente stack overflow), identico a Buffer",
    Buffer.from(grande).toString("base64"), D.base64DaByte(grande));
  c("niente prefisso data:", false, D.base64DaByte(enc("x")).startsWith("data:"));

  gruppo("CHAT · DETTATURA · LETTURA CON IL TETTO");
  const flusso = (pezzi) => new ReadableStream({
    start(ctrl) { for (const p of pezzi) ctrl.enqueue(new Uint8Array(p)); ctrl.close(); },
  });
  const letto = await D.leggiConTetto(flusso([3, 4]), 10);
  c("sotto il tetto: tutti i byte", 7, letto?.length);
  c("oltre il tetto: null (si smette di leggere)", null, await D.leggiConTetto(flusso([6, 6]), 10));
  c("niente corpo: vuoto", 0, (await D.leggiConTetto(null, 10))?.length);

  gruppo("CHAT · DETTATURA · LA RISPOSTA DI OPENROUTER");
  c("{text}: il testo pulito", "Buongiorno, ci vediamo domani alle 10.",
    D.testoDaRisposta({ text: "  Buongiorno,   ci vediamo\tdomani alle 10. \n" }));
  c("a capo dettati restano, gli spazi ai lati no", "Prima riga\nSeconda riga", D.testoDaRisposta({ text: " Prima riga \n Seconda riga " }));
  c("vuoto, solo spazi, niente text: null", [null, null, null, null],
    [{ text: "" }, { text: "  \n" }, {}, null].map(D.testoDaRisposta));
  c("text non stringa: null", null, D.testoDaRisposta({ text: 42 }));
  c("risposta d'errore con un text dentro: null", null, D.testoDaRisposta({ error: { message: "x" }, text: "x" }));
  c("tetto alla lunghezza (4000 caratteri)", 4000, D.testoDaRisposta({ text: "a".repeat(9000) })?.length);

  gruppo("CHAT · DETTATURA · IL TESTO VA NELLA BOZZA, NON PARTE");
  c("casella vuota: il dettato", "Ci vediamo domani", D.bozzaConDettato("", "Ci vediamo domani"));
  c("solo spazi: come vuota", "Ci vediamo domani", D.bozzaConDettato("  \n", "Ci vediamo domani"));
  c("testo già scritto: si aggiunge in coda con uno spazio", "Buongiorno Mario, ci vediamo domani",
    D.bozzaConDettato("Buongiorno Mario,", "ci vediamo domani"));
  c("finisce con un a capo: si aggiunge senza spazio", "Buongiorno\nci vediamo",
    D.bozzaConDettato("Buongiorno\n", "ci vediamo"));
  c("dettato vuoto: la bozza resta com'è", "ciao", D.bozzaConDettato("ciao", ""));

  gruppo("CHAT · DETTATURA · LE FRASI D'ERRORE");
  const codici = ["microfono_negato", "microfono_assente", "non_supportato", "audio_vuoto", "troppo_grande",
    "troppo_lungo", "formato", "durata", "niente_parlato", "trascrizione", "non_configurata", "sessione", "rete"];
  c("ogni codice ha la sua frase in italiano", true, codici.every((k) => typeof D.fraseErrore(k) === "string" && D.fraseErrore(k).length > 10));
  c("microfono negato: dice dove riattivarlo", true, /microfono/i.test(D.fraseErrore("microfono_negato")) && /impostazioni/i.test(D.fraseErrore("microfono_negato")));
  c("trascrizione fallita: «riprova»", true, /riprova/i.test(D.fraseErrore("trascrizione")));
  c("codice sconosciuto: la frase generica", D.fraseErrore("trascrizione"), D.fraseErrore("boh"));
  c("dal nome dell'errore di getUserMedia", ["microfono_negato", "microfono_negato", "microfono_assente", "microfono_assente", "non_supportato"],
    ["NotAllowedError", "SecurityError", "NotFoundError", "NotReadableError", "TypeError"].map(D.codiceDaErroreMicrofono));

  gruppo("CHAT · DETTATURA · NEL SORGENTE");
  const leggi = (f) => readFileSync(join(radice, f), "utf8");
  const route = leggi("src/routes/api.crm.dettatura.ts");
  const casella = leggi("src/crm/chatwa/Casella.tsx");
  const ui = leggi("src/crm/chatwa/Dettatura.tsx");
  c("route dietro guardiaCRM col permesso della chat (lead.propri)", true, /guardiaCRM\(request, cors, "lead\.propri"\)/.test(route));
  c("la guardia viene prima di leggere l'audio", true, route.indexOf("guardiaCRM(") < route.indexOf("leggiConTetto("));
  c("modello e ripiego come da SPEC, lingua it", true,
    /openai\/gpt-4o-transcribe/.test(route) && /openai\/whisper-large-v3/.test(route) && /language: "it"/.test(route));
  c("chiave dall'ambiente, mai scritta", true, /process\.env\.OPENROUTER_API_KEY/.test(route) && !/sk-or-/.test(route));
  c("i log della route non contengono audio, testo o corpi di risposta", true,
    (route.match(/console\.\w+\([^)]*\)/g) ?? []).every((r) => !/(audio|testo|text|base64|corpo|body|json|await)/i.test(r.replace(/^console\.\w+\("[^"]*"/, ""))));
  c("nessun archivio: la route non scrive su Supabase né su storage", false, /supabase|\.insert\(|\.upload\(|\.put\(/i.test(route));
  c("il dettato va nella bozza, mai invia()", true, /bozzaConDettato\(/.test(casella) && !/onTesto[\s\S]{0,200}invia\(\)/.test(casella));
  c("niente invio di vocali al cliente", false, /sendAudio|tipo:\s*"audio"|type:\s*"audio"/.test(casella + ui));
  c("tasto nascosto se il browser non registra", true, /MediaRecorder/.test(ui) && /getUserMedia/.test(ui) && /dettaturaPossibile/.test(casella));
  c("si ferma da solo ai 2 minuti", true, /DURATA_MAX_MS/.test(ui));
  c("il microfono si spegne (tracce fermate)", true, /getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\)/.test(ui));
}
