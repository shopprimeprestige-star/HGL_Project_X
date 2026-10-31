/** ── PROVE: MEETLY SFU · GLI INNESTI IN call.tsx E IL PANNELLO (SEGNAPOSTO, 31/10/2026) ────────────────────────
 *  Registrata in prove/prove.mjs dal compito T1 così che T5 (e T4 per il pannello) non debba
 *  più toccare prove.mjs. Per ora non controlla niente: la riempie T5 (e T4 per il pannello)
 *  (commessa 2026-10-31-meetly-connessione, PIANO.md §3).
 *  Dati inventati: nessun cliente vero. */
export function proveMeetlySfuInnesti(mod, { c, gruppo, radice }) {
  gruppo("MEETLY SFU · GLI INNESTI IN call.tsx E IL PANNELLO (segnaposto)");
  provePannelloTrasporto({ c, gruppo, radice });
}

import { readFileSync as leggiFileT4 } from "node:fs";
import { join as uniscT4 } from "node:path";

/** ── T4 · IL PANNELLO «COME VIAGGIANO AUDIO E VIDEO» ───────────────────────────
 *  Lettura del sorgente (il progetto non ha un ambiente da browser per i componenti): si guarda
 *  quello che il pannello fa e quello che NON deve fare. Il comportamento a schermo è provato
 *  a mano con Playwright (schermate nella cartella del collaudo). */
function provePannelloTrasporto({ c, gruppo, radice }) {
  gruppo("MEETLY SFU · IL PANNELLO DELL'INTERRUTTORE (T4)");
  const leggi = (p) => leggiFileT4(uniscT4(radice, p), "utf8");
  const sorgente = leggi("src/crm/ImpostazioneTrasporto.tsx");
  const meetly = leggi("src/crm/ImpostazioniMeetly.tsx");
  //  I commenti spiegano le regole e nominano cose che il codice non deve contenere: si guarda il codice.
  const codice = sorgente.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");

  //  1. Nessun segreto, nessun valore: solo «pronto» sì/no.
  c("il pannello non nomina né maneggia i segreti", false, /appSecret|MEETLY_SFU_APP|APP_TOKEN|process\.env|Authorization|Bearer/i.test(sorgente));
  c("nessun letterale lungo che somigli a una chiave", false, /["'`][A-Za-z0-9_-]{32,}["'`]/.test(codice));
  c("non legge né mostra altro che `pronto` e `trasporto`", true, /j\.pronto/.test(codice) && /j\.trasporto/.test(codice) && !/j\.(appId|token|chiave|secret)/i.test(codice));

  //  2. Di serie mesh: riga assente, illeggibile o valore strano = mesh.
  c("stato iniziale: scelta e salvato sono mesh", true, /useState<Trasporto>\("mesh"\)[\s\S]*useState<Trasporto>\("mesh"\)/.test(codice));
  c("solo «sfu» esatto vale sfu, il resto è mesh", true, /j\.trasporto === "sfu" \? "sfu" : "mesh"/.test(codice));
  c("senza lettura riuscita `pronto` resta falso", true, /useState\(false\)/.test(codice) && /setPronto\(j\.pronto === true\)/.test(codice));

  //  3. Senza chiavi la scelta SFU è spenta, con la ragione scritta (non un tooltip) e non si salva.
  c("la voce SFU è disabilitata quando `pronto` è falso", true, /value="sfu"[\s\S]{0,80}disabled=\{!pronto\}/.test(codice));
  c("senza chiavi il selezionato è mesh, anche se la riga dice sfu", true, /selezionato: Trasporto = pronto \? scelto : "mesh"/.test(codice));
  c("la ragione è scritta accanto, in parole semplici", true, /Chiavi mancanti: il nuovo sistema resta spento/.test(sorgente) && /\{!pronto && \(/.test(codice));
  c("la ragione non è un tooltip", false, /title=\{|<Tooltip|data-tooltip/.test(codice));
  c("salva rifiuta sfu senza chiavi prima ancora di chiamare la rotta", true, /if \(selezionato === "sfu" && !pronto\) return;[\s\S]*fetchCRM\(ROTTA, \{/.test(codice));
  c("il suggerimento ?trasporto=sfu si mostra solo con le chiavi", true, /\{pronto && \([\s\S]{0,220}\?trasporto=sfu/.test(codice));

  //  4. Il contratto con la rotta di T2.
  c("legge da GET ?stato=1 sulla rotta pubblica", true, /ROTTA = "\/api\/public\/meetly-sfu"/.test(codice) && /`\$\{ROTTA\}\?stato=1`/.test(codice));
  c("scrive con POST azione «config» e il solo campo `trasporto`", true, /method: "POST"/.test(codice) && /JSON\.stringify\(\{ azione: "config", trasporto: selezionato \}\)/.test(codice));
  c("il 409 non-configurato diventa una frase, non un codice", true, /non-configurato[\s\S]{0,160}Mancano le chiavi/.test(codice));
  c("dopo un errore rilegge lo stato vero", true, /toast\.error[\s\S]{0,160}void leggi\(\)/.test(codice));

  //  5. Parole per il titolare: le due scelte, l'avviso, nessun «Prova».
  c("le due scelte hanno i nomi decisi", true, /Diretto tra i partecipanti \(come oggi\)/.test(sorgente) && /Tramite i server Cloudflare \(in prova\)/.test(sorgente));
  c("avviso: vale per le nuove consulenze", true, /Vale per le nuove consulenze; quelle già avviate restano come sono/.test(sorgente));
  c("titolo del pannello", true, /Come viaggiano audio e video/.test(sorgente));
  c("niente pulsante «Prova»", false, />\s*Prova\b/.test(sorgente));
  c("stati: caricamento ed errore di lettura hanno la loro frase", true, /carico \?/.test(codice) && /Non riesco a leggere come viaggiano audio e video/.test(sorgente) && /Riprova/.test(sorgente));

  //  6. L'innesto in ImpostazioniMeetly.tsx sono solo due righe (import e montaggio).
  c("ImpostazioniMeetly importa e monta il pannello", true, /import \{ ImpostazioneTrasporto \} from "\.\/ImpostazioneTrasporto";/.test(meetly) && /<ImpostazioneTrasporto \/>/.test(meetly));
  c("e lo monta una volta sola", 1, (meetly.match(/<ImpostazioneTrasporto \/>/g) || []).length);
}
