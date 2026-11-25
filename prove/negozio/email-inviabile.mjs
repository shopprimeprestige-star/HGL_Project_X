/** ── NEGOZIO · R2 · T49 · LE EMAIL DELLO SHOP: QUANDO UN MESSAGGIO SI PUÒ MANDARE (PURO) ─────────────────────
 *  `src/shop/email/inviabile.ts`, `tipi.ts`, `modelli-base.ts` (PIANO-R2 D53, T49; contratto della revisione di T43).
 *  Regola: acceso ⇒ approvato sull'impronta di OGGI ⇒ nessun `{{` (segnaposto, sempre) ⇒ solo variabili `{x}` della chiave.
 *  Dati inventati: nessun dato di clienti veri. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");

export async function prove(mod, { c, gruppo, radice }) {
  const I = mod["shop/email/inviabile"];
  const T = mod["shop/email/tipi"];
  const B = mod["shop/email/modelli-base"];
  gruppo("NEGOZIO R2 · EMAIL: QUANDO UN MESSAGGIO SI PUÒ MANDARE (T49)");

  /** Un modello acceso e approvato sull'impronta del suo testo (come lo lascerebbe il database); `extra` cambia campi. */
  const modello = (chiave, oggetto, testo, extra = {}) => ({
    chiave, oggetto, testo, acceso: true, approvato_da: "titolare", approvato_il: "2026-11-21T10:00:00.000Z", approvato_hash: sha(`${oggetto}\n${testo}`), ...extra,
  });
  const esito = (m) => I.messaggioInviabile(m);
  const motivo = (m) => { const e = esito(m); return e.ok ? "ok" : e.motivo; };
  const PULITO = modello("conferma_ordine", "Il tuo ordine {ref}", "Ciao {nome}, ecco il riepilogo.\n\n{riepilogo_righe}\n\nTotale {totale}\nSpedizione a:\n{indirizzo_spedizione}\n\nHair Genius Labs");

  // ── l'impronta è quella del database: sha256 di «oggetto, a capo, testo» ──
  c("impronta: sha256 esadecimale di «oggetto\\ntesto» (stessa del SQL e del finto)", [sha("Oggetto\nTesto"), sha("\n")], [I.impronta("Oggetto", "Testo"), I.impronta("", "")]);
  c("impronta: vettore noto (sha256 della sola «\\n», con oggetto e testo vuoti)", "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b", I.impronta("", ""));
  c("impronta: le lettere accentate si contano in UTF-8", sha("Perché è già\nCittà ù"), I.impronta("Perché è già", "Città ù"));
  c("impronta: testo lungo (oltre un blocco da 64 byte, due blocchi di imbottitura) uguale a quello del sistema", [sha(`${"x".repeat(55)}\n${"y".repeat(200)}`), sha(`${"é".repeat(31)}\n`)], [I.impronta("x".repeat(55), "y".repeat(200)), I.impronta("é".repeat(31), "")]);

  // ── il caso buono e i rifiuti, nell'ordine di precedenza ──
  c("acceso + approvato + testo pulito → inviabile", { ok: true }, esito(PULITO));
  c("acceso ma NON approvato (nessun hash) → non_approvato", "non_approvato", motivo({ ...PULITO, approvato_hash: null, approvato_da: null, approvato_il: null }));
  c("approvato ma SPENTO → spento", "spento", motivo({ ...PULITO, acceso: false }));
  c("`acceso` deve essere proprio true: «true», 1 o assente → spento", Array(3).fill("spento"), ["true", 1, undefined].map((a) => motivo({ ...PULITO, acceso: a })));
  c("testo con {{da confermare}} → segnaposto ANCHE se acceso e approvato", "segnaposto", motivo(modello("conferma_ordine", "Ordine", "{{da confermare}} Ciao")));
  c("segnaposto solo nell'oggetto → segnaposto", "segnaposto", motivo(modello("spedito", "{{da confermare}} Spedito", "Ciao {nome}")));
  c("chi scrive {{nome}} per abitudine è bloccato (come fa il database)", "segnaposto", motivo(modello("conferma_ordine", "Ordine {ref}", "Ciao {{nome}}")));
  c("un `{{` solitario o `{{{nome}}}` → segnaposto", Array(2).fill("segnaposto"), [modello("annullato", "A", "Ciao {{ "), modello("annullato", "A", "Ciao {{{nome}}}")].map(motivo));
  c("testo modificato DOPO l'approvazione (impronta diversa) → non_approvato", "non_approvato", motivo({ ...PULITO, testo: `${PULITO.testo} Grazie.` }));
  c("oggetto modificato dopo l'approvazione → non_approvato", "non_approvato", motivo({ ...PULITO, oggetto: "Altro oggetto" }));
  c("l'impronta approvata deve essere IDENTICA (maiuscole, spazi, vuota → non approvato)", Array(3).fill("non_approvato"), [PULITO.approvato_hash.toUpperCase(), ` ${PULITO.approvato_hash}`, ""].map((h) => motivo({ ...PULITO, approvato_hash: h })));
  c("oggetto o testo vuoti (anche solo spazi) → vuoto", Array(3).fill("vuoto"), [modello("annullato", "", "Ciao"), modello("annullato", "Annullato", "   \n "), modello("annullato", "  ", "Ciao")].map(motivo));
  c("precedenze: spento batte segnaposto; segnaposto batte non_approvato", ["spento", "segnaposto"], [motivo({ ...PULITO, acceso: false, testo: "{{da confermare}}" }), motivo({ ...PULITO, testo: "{{da confermare}}" })]);

  // ── le variabili a graffa singola ──
  c("variabile sconosciuta {cognome} → variabile_sconosciuta (approvato e acceso)", "variabile_sconosciuta", motivo(modello("conferma_ordine", "Ordine", "Ciao {cognome}")));
  c("variabile sconosciuta anche nell'oggetto", "variabile_sconosciuta", motivo(modello("conferma_ordine", "Ordine {telefono}", "Ciao")));
  c("maiuscole, spazi dentro, vuota, graffa aperta o chiusa da sola → variabile_sconosciuta", Array(5).fill("variabile_sconosciuta"), ["Ciao {Nome}", "Ciao { nome }", "Ciao {}", "Ciao {nome", "Ciao nome}"].map((t) => motivo(modello("annullato", "Annullato", t))));
  c("la prima variabile sbagliata basta, anche in mezzo a quelle giuste", "variabile_sconosciuta", motivo(modello("annullato", "Annullato {ref}", "Ciao {nome}, {ref}, {boh}")));
  c("le variabili note di ogni chiave sono ammesse (tutte insieme, ripetute)", Array(5).fill("ok"), T.CHIAVI_EMAIL.map((k) => motivo(modello(k, T.VARIABILI_PER_CHIAVE[k].map((v) => `{${v}}`).join(" "), `${T.VARIABILI_PER_CHIAVE[k].map((v) => `{${v}}`).join("\n")}\n{nome} {nome}`))));
  c("{riepilogo_righe} e {indirizzo_spedizione} SOLO nella conferma; negli altri quattro → variabile_sconosciuta", { conferma_ordine: ["ok", "ok"], spedito: ["variabile_sconosciuta", "variabile_sconosciuta"], pagamento_non_riuscito: ["variabile_sconosciuta", "variabile_sconosciuta"], rimborso: ["variabile_sconosciuta", "variabile_sconosciuta"], annullato: ["variabile_sconosciuta", "variabile_sconosciuta"] },
    Object.fromEntries(T.CHIAVI_EMAIL.map((k) => [k, ["{riepilogo_righe}", "{indirizzo_spedizione}"].map((v) => motivo(modello(k, "Oggetto", `Ciao ${v}`)))])));
  c("i prezzi solo dove servono: {totale} solo nella conferma, {importo_rimborso} solo nel rimborso, il tracking solo in «spedito»", {
    totale: ["ok", "variabile_sconosciuta", "variabile_sconosciuta", "variabile_sconosciuta", "variabile_sconosciuta"],
    importo_rimborso: ["variabile_sconosciuta", "variabile_sconosciuta", "variabile_sconosciuta", "ok", "variabile_sconosciuta"],
    link_tracking: ["variabile_sconosciuta", "ok", "variabile_sconosciuta", "variabile_sconosciuta", "variabile_sconosciuta"],
    corriere: ["variabile_sconosciuta", "ok", "variabile_sconosciuta", "variabile_sconosciuta", "variabile_sconosciuta"],
    numero_tracking: ["variabile_sconosciuta", "ok", "variabile_sconosciuta", "variabile_sconosciuta", "variabile_sconosciuta"],
  }, Object.fromEntries(["totale", "importo_rimborso", "link_tracking", "corriere", "numero_tracking"].map((v) => [v, T.CHIAVI_EMAIL.map((k) => motivo(modello(k, "Oggetto", `Ciao {${v}}`)))])));
  c("pagamento_non_riuscito non ha prezzi: né {totale} né {importo_rimborso} né {riepilogo_righe}", [], T.VARIABILI_PER_CHIAVE.pagamento_non_riuscito.filter((v) => ["totale", "importo_rimborso", "riepilogo_righe", "indirizzo_spedizione"].includes(v)));
  c("l'indirizzo e il riepilogo compaiono nell'elenco della sola conferma", [true, false, false, false, false], T.CHIAVI_EMAIL.map((k) => T.VARIABILI_PER_CHIAVE[k].includes("indirizzo_spedizione") && T.VARIABILI_PER_CHIAVE[k].includes("riepilogo_righe")));
  c("`variabiliUsate`: i nomi tra graffe nell'ordine di comparsa, senza doppioni", ["nome", "ref"], I.variabiliUsate("Ciao {nome}, {ref}, {nome} e {{x}}").filter((v) => v === "nome" || v === "ref"));

  // ── modelli malformati: mai un'eccezione, mai «inviabile» ──
  c("chiave sconosciuta → non_approvato (non può avere un'approvazione valida)", "non_approvato", motivo(modello("newsletter", "Ciao", "Ciao")));
  c("null, numero, oggetto vuoto, testi non stringa → rifiutati senza eccezioni", Array(5).fill(false), [null, 42, {}, { chiave: "annullato", acceso: true, oggetto: 1, testo: 2 }, undefined].map((m) => esito(m).ok));

  // ── l'elenco delle chiavi e il mittente ──
  c("le cinque chiavi di S6, in quest'ordine", ["conferma_ordine", "spedito", "pagamento_non_riuscito", "rimborso", "annullato"], [...T.CHIAVI_EMAIL]);
  c("ogni chiave ha il suo elenco di variabili e nessun'altra", T.CHIAVI_EMAIL, Object.keys(T.VARIABILI_PER_CHIAVE));
  c("mittente: nome fisso «Hair Genius Labs»", "Hair Genius Labs", T.NOME_MITTENTE);
  c("intestazione del mittente: nome + indirizzo di `SHOP_EMAIL_INDIRIZZO`", "Hair Genius Labs <negozio@example.com>", T.intestazioneMittente("negozio@example.com"));
  c("indirizzo mancante, senza chiocciola, con a capo o con `<`/`>` → null (niente iniezioni nell'intestazione)", Array(6).fill(null), [undefined, "", "negozio", "a@b.it\nBcc: x@y.it", "<x@y.it>", "x@y.it, z@y.it"].map((a) => T.intestazioneMittente(a)));
  c("la risposta («reply_to») è lo stesso indirizzo", "negozio@example.com", T.intestazioneMittente("negozio@example.com")?.match(/<(.+)>/)?.[1]);

  // ── i cinque modelli di partenza: segnaposto, spenti, senza testi veri ──
  c("cinque modelli di base, uno per chiave", T.CHIAVI_EMAIL, B.MODELLI_BASE.map((m) => m.chiave));
  c("tutti spenti e senza approvazione", Array(5).fill([false, null]), B.MODELLI_BASE.map((m) => [m.acceso, m.approvato_hash ?? null]));
  c("tutti con {{da confermare}} nell'oggetto e nel testo", Array(5).fill([true, true]), B.MODELLI_BASE.map((m) => [m.oggetto.includes("{{da confermare}}"), m.testo.includes("{{da confermare}}")]));
  c("non inviabili: spenti (spento) e, anche forzati e approvati, segnaposto", [Array(5).fill("spento"), Array(5).fill("segnaposto")], [
    B.MODELLI_BASE.map((m) => motivo(m)), B.MODELLI_BASE.map((m) => motivo({ ...m, acceso: true, approvato_hash: sha(`${m.oggetto}\n${m.testo}`) }))]);
  c("firmati «Hair Genius Labs»", Array(5).fill(true), B.MODELLI_BASE.map((m) => m.testo.includes("Hair Genius Labs")));
  const tuttoBase = B.MODELLI_BASE.map((m) => `${m.oggetto}\n${m.testo}`).join("\n");
  c("nessun indirizzo dello studio, nessuna cifra, nessun prezzo, nessuna consulenza né «Invisible Derm»", [], [/Scipioni/i, /\d/, /€|euro/i, /consulenz/i, /invisible\s*derm/i, /upsell|sconto|offerta/i, /\bvia\b|\bviale\b|\bpiazza\b/i].filter((re) => re.test(tuttoBase)).map(String));
  c("«pagamento_non_riuscito»: niente prezzi né rosso", false, /€|euro|\{totale\}|rosso|red\b|#[a-f0-9]{3,6}/i.test(B.MODELLI_BASE.find((m) => m.chiave === "pagamento_non_riuscito").testo));
  // gli stessi cinque testi del seme di S6 (T43): se cambia uno, cambia anche l'altro
  const sql = readFileSync(join(radice, "supabase/migrations/20261122140000_shop_email.sql"), "utf8");
  const seme = [...sql.matchAll(/\('(\w+)',\s*'((?:[^']|'')*)',\s*E?'((?:[^']|'')*)'\)/g)].map((m) => ({ chiave: m[1], oggetto: m[2].replace(/''/g, "'"), testo: m[3].replace(/''/g, "'").replace(/\\n/g, "\n") }));
  c("i modelli di base sono IDENTICI al seme di S6 (stesso oggetto, stesso testo)", seme, B.MODELLI_BASE.map(({ chiave, oggetto, testo }) => ({ chiave, oggetto, testo })));
  c("il seme di S6 non usa variabili `{x}` (la sintassi nuova non lo tocca) e ha solo {{da confermare}} come doppia graffa", [], seme.flatMap((m) => [...`${m.oggetto}\n${m.testo}`.replace(/\{\{da confermare\}\}/g, "").matchAll(/[{}]/g)]).map((x) => x[0]));

  // ── i sorgenti: nessun indirizzo dello studio, nessun accesso a database o a servizi ──
  const sorgenti = ["tipi", "inviabile", "compone", "modelli-base"].map((f) => [f, readFileSync(join(radice, "src/shop/email", `${f}.ts`), "utf8")]);
  c("nei quattro file non compaiono «Scipioni» né l'indirizzo dello studio", [], sorgenti.filter(([, t]) => /Scipioni/i.test(t)).map(([f]) => f));
  c("moduli puri: nessun import di database, server o servizi di posta", [], sorgenti.filter(([, t]) => /from\s+["'](?:@\/integrations|@supabase|resend|node:)/.test(t) || /process\.env|fetch\(/.test(t)).map(([f]) => f));
}
