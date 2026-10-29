/** ── LE PROVE DI «CHI CHIAMARE ADESSO», DEL RIEPILOGO DEL MATTINO E DEI DOPPI ─
 *
 *  Commessa 2026-10-30-ottimizzazioni, pacchetto p6-lead-doppi-chiamate:
 *   (7)  «Chi chiamare adesso»: una classifica sola per consulente;
 *   (16) il riepilogo del mattino (push + email, mai WhatsApp);
 *   (14) i lead doppi: segnalati, uniti solo da una persona, niente cancellato.
 *  `prove/prove.mjs` impacchetta `chi-chiamare-adesso` e `riepilogo-mattino` e
 *  chiama `proveLeadDoppiChiamate(mod, aiuti)`.
 *
 *  ⚠️ Dati inventati: nomi di fantasia, numeri finti, nessuna email vera. Le
 *   date in ora LOCALE, così l'esito non cambia col fuso di chi lancia.
 *  ───────────────────────────────────────────────────────────────────────── */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export async function proveLeadDoppiChiamate(mod, { c, gruppo, radice }) {
  const ADE = mod["chi-chiamare-adesso"];
  const RIE = mod["riepilogo-mattino"];
  const TEL = mod["telefono-doppio"];
  const DOPPI = mod["doppioni"];

  gruppo("P6 · I MODULI NUOVI ESISTONO");
  c(
    "chi-chiamare-adesso: classificaAdesso, voceAdesso",
    ["function", "function"],
    [typeof ADE?.classificaAdesso, typeof ADE?.voceAdesso],
  );
  c(
    "riepilogo-mattino: riepilogoMattino, avvisoRiepilogo, emailRiepilogo",
    ["function", "function", "function"],
    [typeof RIE?.riepilogoMattino, typeof RIE?.avvisoRiepilogo, typeof RIE?.emailRiepilogo],
  );

  /* ═══ (7) CHI CHIAMARE ADESSO ═══════════════════════════════════════════ */
  gruppo("P6 · CHI CHIAMARE ADESSO: UNA CLASSIFICA SOLA");
  const ADESSO = new Date(2026, 9, 30, 10, 0);
  const fa = (ore) => new Date(ADESSO.getTime() - ore * 3_600_000).toISOString();
  const L = (id, data) => ({
    id,
    created_at: fa(100),
    data: { nome: id, stato: "da_contattare", createdAt: fa(100), ...data },
  });
  const risposto = (ore) => ({ stato: "ha_risposto", il: fa(ore), da: "automatico", storia: [] });

  const nuovo = L("Nuovo", {});
  const caldo = L("Caldo", { modulo: { urgenza: "subito" } });
  const richiamo = L("Richiamo", { stato: "richiamo", dataRicontatto: "2026-10-29" });
  const rispostoOra = L("RispostoOra", { stato: "non_risponde", contattoWa: risposto(1) });
  const rispostoPrima = L("RispostoPrima", { stato: "sta_valutando", contattoWa: risposto(3) });
  const rispostoVecchio = L("RispostoVecchio", { stato: "da_chiamare", contattoWa: risposto(30) });
  const futuro = L("Futuro", { stato: "richiamo", dataRicontatto: "2026-11-05" });
  const vinto = L("Vinto", { stato: "acconto", contattoWa: risposto(1) });
  const saltato = L("Saltato", { saltatoIl: fa(5) });
  const assorbito = L("Assorbito", { unitoIn: "Nuovo" });
  const appuntamento = L("Appuntamento", { stato: "appuntamento_fissato" });

  const tutti = [nuovo, caldo, richiamo, rispostoVecchio, rispostoPrima, rispostoOra, futuro, vinto, saltato, assorbito, appuntamento];
  const cl = ADE.classificaAdesso(tutti, ADESSO);
  c(
    "l'ordine: ha risposto da poco › richiamo scaduto › caldo › da chiamare",
    ["RispostoOra", "RispostoPrima", "Richiamo", "Caldo", "Nuovo", "RispostoVecchio"],
    cl.map((v) => v.lead.id),
  );
  c(
    "…con il motivo su ogni riga",
    ["risposto", "risposto", "richiamo", "caldo", "daChiamare", "daChiamare"],
    cl.map((v) => v.motivo),
  );
  c("fra chi ha risposto, il più recente per primo", "ha risposto su WhatsApp 1 h fa", cl[0].testo);
  c("una risposta di 30 ore fa non è «da poco»: torna da chiamare", "daChiamare", ADE.voceAdesso(rispostoVecchio, ADESSO)?.motivo);
  c("un richiamo per un giorno futuro non c'è", null, ADE.voceAdesso(futuro, ADESSO));
  c("chi ha comprato non si chiama, anche se ha scritto", null, ADE.voceAdesso(vinto, ADESSO));
  c("un saltato non c'è", null, ADE.voceAdesso(saltato, ADESSO));
  c("⚠️ una scheda unita in un'altra non c'è (la persona è una sola)", null, ADE.voceAdesso(assorbito, ADESSO));
  c("un appuntamento fissato che non ha scritto non è da chiamare", null, ADE.voceAdesso(appuntamento, ADESSO));
  c(
    "un appuntamento fissato che HA scritto da poco sì: la palla è nostra",
    "risposto",
    ADE.voceAdesso(L("AppScritto", { stato: "appuntamento_fissato", contattoWa: risposto(2) }), ADESSO)?.motivo,
  );
  c("il richiamo dice da quanto è scaduto", true, /scaduto da 1 giorno/.test(ADE.voceAdesso(richiamo, ADESSO)?.testo ?? ""));
  c("un orologio avanti di un minuto non fa sparire una risposta", "risposto",
    ADE.voceAdesso(L("Avanti", { contattoWa: { ...risposto(0), il: new Date(ADESSO.getTime() + 60_000).toISOString() } }), ADESSO)?.motivo);
  c("una data di risposta illeggibile non è «da poco»", "daChiamare",
    ADE.voceAdesso(L("Rotta", { contattoWa: { ...risposto(0), il: "boh" } }), ADESSO)?.motivo);

  gruppo("P6 · CHI CHIAMARE ADESSO: PER CONSULENTE");
  const diAnna = (x) => ({ ...x, data: { ...x.data, consulenteId: "anna" } });
  const conConsulente = [diAnna(nuovo), caldo, diAnna(rispostoOra)];
  c("solo quelli di Anna", ["RispostoOra", "Nuovo"], ADE.classificaAdesso(conConsulente, ADESSO, "anna").map((v) => v.lead.id));
  c("senza filtro, tutti", 3, ADE.classificaAdesso(conConsulente, ADESSO).length);
  c("«di nessuno» = senza consulente", ["Caldo"], ADE.classificaAdesso(conConsulente, ADESSO, "").map((v) => v.lead.id));
  c("elenco vuoto o rotto: niente, senza errori", [0, 0], [ADE.classificaAdesso(null, ADESSO).length, ADE.classificaAdesso([null, { id: "x" }], ADESSO).length]);

  /* ═══ (16) IL RIEPILOGO DEL MATTINO ═════════════════════════════════════ */
  gruppo("P6 · IL RIEPILOGO DEL MATTINO");
  const MATTINO = new Date(2026, 9, 30, 7, 45);
  const consulenti = [
    { id: "anna", data: { nome: "Anna", email: "anna@esempio.invalid", attivo: true } },
    { id: "bruno", data: { nome: "Bruno", attivo: true } },
    { id: "spento", data: { nome: "Spento", attivo: false } },
  ];
  const leads = [
    L("A1", { consulenteId: "anna", stato: "appuntamento_fissato", dataMeeting: "2026-10-30", oraMeeting: "11:00" }),
    L("A2", { consulenteId: "anna", stato: "appuntamento_fissato", dataMeeting: "2026-10-31" }),
    L("A3", { consulenteId: "anna", stato: "non_risponde", contattoWa: { stato: "ha_risposto", il: new Date(2026, 9, 30, 7, 0).toISOString(), da: "automatico", storia: [] } }),
    L("A4", { consulenteId: "anna", stato: "richiamo", dataRicontatto: "2026-10-28" }),
    L("S1", { stato: "da_contattare", telefono: "+39 333 0000001" }),
    L("S2", { stato: "da_contattare", telefono: "333 0000001" }),
  ];
  const r = RIE.riepilogoMattino({ leads, consulenti, adesso: MATTINO });
  const anna = r.perConsulente.find((x) => x.id === "anna");
  c("Anna: 1 consulenza oggi, 2 da chiamare, 1 ha risposto, 1 richiamo scaduto",
    { consulenzeOggi: 1, daChiamare: 2, risposti: 1, richiami: 1 },
    { consulenzeOggi: anna?.consulenzeOggi, daChiamare: anna?.daChiamare, risposti: anna?.risposti, richiami: anna?.richiami });
  c("Bruno non ha niente: c'è, a zero (non gli si manda niente)", [true, 0], [!!r.perConsulente.find((x) => x.id === "bruno"), RIE.daMandare(r.perConsulente.find((x) => x.id === "bruno")) ? 1 : 0]);
  c("un consulente spento non riceve il riepilogo", undefined, r.perConsulente.find((x) => x.id === "spento"));
  c("titolare: tutti i da chiamare, quelli senza consulente e i numeri doppi",
    { daChiamare: 4, senzaConsulente: 2, doppioni: 1, consulenzeOggi: 1 },
    { daChiamare: r.titolare.daChiamare, senzaConsulente: r.titolare.senzaConsulente, doppioni: r.titolare.doppioni, consulenzeOggi: r.titolare.consulenzeOggi });
  c("il giorno è quello di Roma", "2026-10-30", r.giorno);

  gruppo("P6 · IL RIEPILOGO: CHE COSA DICE, E CHE COSA NO");
  const av = RIE.avvisoRiepilogo(anna, r.giorno);
  c("la notifica: titolo, corpo con i numeri, una al giorno, apre Da fare oggi",
    { titolo: "Buongiorno Anna", destinazione: "/CRM/dafare", chiave: "riepilogo:2026-10-30" },
    { titolo: av.titolo, destinazione: av.destinazione, chiave: av.chiave });
  c("…il corpo dice i numeri", "1 consulenza oggi · 2 da chiamare (1 ha risposto) · 1 richiamo scaduto", av.corpo);
  const avT = RIE.avvisoRiepilogo(r.titolare, r.giorno);
  c("…al titolare anche i doppioni e chi non è di nessuno", true, /2 senza consulente/.test(avT.corpo) && /1 numero doppio/.test(avT.corpo));
  const em = RIE.emailRiepilogo(anna, r.giorno, "https://crm.esempio.invalid");
  c("l'email: oggetto col giorno, link a Da fare oggi", [true, true], [/30\/10/.test(em.oggetto), em.html.includes("https://crm.esempio.invalid/CRM/dafare")]);
  const nomi = leads.map((l) => l.data.nome);
  c("⚠️ niente nomi né numeri dei clienti, né nella notifica né nell'email", [],
    nomi.filter((n) => av.corpo.includes(n) || avT.corpo.includes(n) || em.html.includes(n)).concat(
      ["333", "0000001"].filter((t) => avT.corpo.includes(t) || em.html.includes(t))));
  c("un nome di consulente con < > non rompe l'email", false,
    RIE.emailRiepilogo({ ...anna, nome: "<b>x</b>" }, r.giorno, "https://crm.esempio.invalid").html.includes("<b>x</b>"));

  /* ═══ (14) I DOPPI ══════════════════════════════════════════════════════ */
  gruppo("P6 · DOPPI: L'AVVISO ROSSO NON CONTA LE SCHEDE GIÀ UNITE");
  const schede = [
    { id: "A", data: { telefono: "333 1234567", nome: "Ada" } },
    { id: "B", data: { telefono: "+39 333 1234567", nome: "Ada", unitoIn: "A" } },
  ];
  c("la scheda unita non fa diventare rosso il campo della principale", [],
    TEL.schedeConLoStessoNumero({ telefono: "333 1234567", schede, escludiId: "A" }).map((s) => s.id));
  c("…ma una scheda doppia vera sì", ["C"],
    TEL.schedeConLoStessoNumero({ telefono: "333 1234567", schede: [...schede, { id: "C", data: { telefono: "3331234567" } }], escludiId: "A" }).map((s) => s.id));
  c("e i gruppi dei doppioni sono gli stessi che conta il riepilogo", 1, DOPPI.doppioniPerTelefono(leads).length);

  gruppo("P6 · DOPPI: UNIRE LO DECIDE UNA PERSONA, E NON SI CANCELLA NIENTE");
  const unione = readFileSync(join(radice, "src/crm/doppioni-unione.ts"), "utf8");
  c("l'unione è un modulo solo, usato da Lead importati e da Da fare oggi", [true, true],
    ["src/routes/CRM.importa.tsx", "src/crm/dafare/DoppioniDaGuardare.tsx"].map((f) =>
      readFileSync(join(radice, f), "utf8").includes("useUnioneSchede")));
  c("…scrive solo con updateLead (niente deleteLead, niente delete)", [false, true],
    [/deleteLead|\.delete\(/.test(unione), /updateLead\(/.test(unione)]);
  const hook = readFileSync(join(radice, "src/routes/hooks/riepilogo-mattino.ts"), "utf8");
  c("il riepilogo non unisce niente da solo e non scrive sulle schede", false,
    /patchUnione|patchAssorbita|from\("crm_leads"\)\s*\.(update|upsert|delete|insert)/.test(hook));
  c("⚠️ il riepilogo non manda WhatsApp", false, /manychat|whatsapp_messages|ponte|inviaWhatsapp/i.test(hook));
  c("…nei log solo conteggi e codici", true,
    (hook.match(/console\.\w+\([^)]*\)/g) ?? []).every((x) => /\[riepilogo-mattino\]/.test(x) && !/nome|telefono|email/.test(x)));
  c("…una volta al giorno: prima la notifica con la chiave del giorno, poi gli invii", true,
    hook.indexOf("dedupe_key") > -1 && hook.indexOf("dedupe_key") < hook.indexOf("inviaATutti("));

  gruppo("P6 · LA MIGRAZIONE");
  const cartella = join(radice, "supabase/migrations");
  const nostra = readdirSync(cartella).filter((f) => /^20261030\d{6}_p6-lead-doppi-chiamate\.sql$/.test(f));
  c("un file nuovo, col nome del pacchetto", 1, nostra.length);
  const sql = nostra[0] && existsSync(join(cartella, nostra[0])) ? readFileSync(join(cartella, nostra[0]), "utf8") : "";
  const senzaCommenti = sql.replace(/^\s*--.*$/gm, "");
  c("programma il cron del riepilogo con la funzione di sempre", true,
    /programma_hook_cron\('riepilogo-mattino[^']*',\s*'[^']+',\s*'\/hooks\/riepilogo-mattino'\)/.test(senzaCommenti));
  c("solo aggiuntiva: niente DROP, DELETE, TRUNCATE, ALTER", false, /\b(DROP|DELETE|TRUNCATE|ALTER)\b/i.test(senzaCommenti));
}
