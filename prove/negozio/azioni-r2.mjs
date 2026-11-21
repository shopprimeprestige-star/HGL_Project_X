/** ── NEGOZIO · R2 · T47 · LE AZIONI SULL'ORDINE, NUOVE (PURO) ─────────────────────────────────────────────
 *  `src/crm/ecommerce/azioni.ts` (D55; SPEC 8A n. 2, 6, 7; 7.4 n. 5). Le otto azioni nuove (`spedisci`, `annulla`, `rimborso`, `riconcilia`,
 *  `fattura_emessa`, `email_invia`, `giacenza_verificata`, `correggi_stato`) e il vincolo sulle cinque vecchie: per un ordine con `stato_pagamento`
 *  valorizzato `pagato`, `pagamento_annullato`, `tracking` e `stato → spedito|annullato` sono rifiutate («usa Controlla con Stripe / Spedisci /
 *  Annulla»); per un ordine vecchio (colonna vuota) TUTTO resta come oggi (`prove/ecommerce/azioni.mjs` resta verde senza modifiche).
 *  Dati inventati (`@example.com`, UUID finti): nessun dato di clienti veri. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rigaOrdineProva } from "../ecommerce/dati.mjs";

const ID = "00000000-0000-4000-8000-000000000001";
const CHIAVE = "00000000-0000-4000-8000-0000000000c1";
const ADESSO = new Date("2026-11-21T12:00:00.000Z");
const ISO = ADESSO.toISOString();

/** Congela in profondità: se il modulo prova a scrivere sull'ordine in ingresso, lancia. */
function congela(o) {
  Object.values(o).forEach((v) => v && typeof v === "object" && !Object.isFrozen(v) && congela(v));
  return Object.freeze(o);
}

export async function prove(mod, { c, gruppo, radice }) {
  const A = mod["ecommerce/azioni"];
  const P = mod["ecommerce/pagamento"];
  const O = mod["ecommerce/ordine"];
  const src = readFileSync(join(radice, "src/crm/ecommerce/azioni.ts"), "utf8");
  const stripe = (extra = {}) => congela(O.normalizzaOrdine(rigaOrdineProva({ stato_pagamento: "pagato", pagato_il: "2026-11-20T10:00:00.000Z", pagato_importo: 24.9, metodo_pagamento: "stripe", canale: "sito", totale_cent: 2490, ...extra })));
  const vecchio = (extra = {}) => congela(O.normalizzaOrdine(rigaOrdineProva(extra)));
  const va = (a, o = stripe(), ctx) => A.costruisciAzione({ ordineId: ID, ...a }, o, ADESSO, ctx);
  const chiavi = (r) => Object.keys(r.patch).sort();
  const rifiutata = (r, regex, motivo = "valore") => r.ok === false && r.motivo === motivo && typeof r.errore === "string" && r.errore.length > 12 && (!regex || regex.test(r.errore));
  const IN_ATTESA = { stato_pagamento: "in_attesa", pagato_il: null, pagato_importo: null, metodo_pagamento: null };
  const BRT = [{ nome: "BRT", modello: "https://tracking.example/brt?codice={numero}" }, { nome: "GLS", modello: "" }];
  gruppo("NEGOZIO R2 · LE AZIONI SULL'ORDINE, NUOVE (T47)");

  // ══ spedisci ══════════════════════════════════════════════════════════════════════════════════════
  const sp = (extra) => ({ azione: "spedisci", corriere: "BRT", numero: "123456789012", ...extra });
  const s1 = va(sp({}));
  c("spedisci: corriere e numero → patch con stato, data, corriere, tracking, senza_tracking falso", [true, ["aggiornato_il", "corriere", "senza_tracking", "spedito_il", "status", "tracking", "tracking_url"], "spedito", ISO, "BRT", "123456789012", false], [s1.ok, chiavi(s1), s1.patch.status, s1.patch.spedito_il, s1.patch.corriere, s1.patch.tracking, s1.patch.senza_tracking]);
  c("spedisci: condizioni = stato di evasione e stato di pagamento visti; evento «spedito» con corriere e numero", [{ status: "nuovo", stato_pagamento: "pagato" }, "spedito", "BRT", "123456789012"], [s1.condizioni, s1.evento.tipo, s1.evento.dopo.corriere, s1.evento.dopo.tracking]);
  c("spedisci: senza elenco dei corrieri passato, il link non c'è (modelli vuoti)", null, s1.patch.tracking_url);
  c("spedisci: con il modello del corriere il link si costruisce", "https://tracking.example/brt?codice=123456789012", va(sp({}), stripe(), { corrieri: BRT }).patch.tracking_url);
  c("spedisci: corriere senza modello valido → spedito lo stesso, link vuoto", [true, null], ((r) => [r.ok, r.patch.tracking_url])(va(sp({ corriere: "GLS" }), stripe(), { corrieri: BRT })));
  c("spedisci: il nome del corriere si scrive come nell'elenco (brt → BRT)", "BRT", va(sp({ corriere: "brt" })).patch.corriere);
  c("spedisci: spazi ai bordi del numero tolti", "123456789012", va(sp({ numero: "  123456789012  " })).patch.tracking);
  c("spedisci: senza corriere e senza `senzaTracking` → rifiutata con la frase", true, rifiutata(va({ azione: "spedisci" }), /corriere/i));
  c("spedisci: corriere ma senza numero → rifiutata", true, rifiutata(va(sp({ numero: undefined })), /numero/i));
  c("spedisci: numero non valido (corto, con tag) → rifiutata", [true, true], [va(sp({ numero: "12" })), va(sp({ numero: "<b>12345</b>" }))].map((r) => rifiutata(r, /numero/i)));
  c("spedisci: numero ma senza corriere → rifiutata", true, rifiutata(va(sp({ corriere: undefined })), /corriere/i));
  c("spedisci: corriere fuori dall'elenco (quello di partenza, o quello passato) → rifiutata", [true, true], [rifiutata(va(sp({ corriere: "Piccione" })), /elenco/i), rifiutata(va(sp({ corriere: "DHL" }), stripe(), { corrieri: BRT }), /elenco/i)]);
  c("spedisci: un corriere di partenza vale anche senza elenco passato", true, va(sp({ corriere: "Poste Italiane" })).ok);
  const s2 = va({ azione: "spedisci", senzaTracking: true });
  c("spedisci con `senzaTracking:true`: passa, `tracking` vuoto, `senza_tracking` vero, nessun link", [true, null, true, null, null, "spedito"], [s2.ok, s2.patch.tracking, s2.patch.senza_tracking, s2.patch.tracking_url, s2.patch.corriere, s2.patch.status]);
  c("spedisci con `senzaTracking:true` ignora corriere e numero scritti", [null, null], ((r) => [r.patch.tracking, r.patch.corriere])(va(sp({ senzaTracking: true }))));
  c("spedisci: `senzaTracking` in testo («true»), 1 → non vale: serve corriere e numero", [true, true], ["true", 1].map((v) => rifiutata(va({ azione: "spedisci", senzaTracking: v }), /corriere/i)));
  c("spedisci: ordine in attesa → rifiutata (anche con scadenza passata)", [true, true], [va(sp({}), stripe(IN_ATTESA)), va(sp({}), stripe({ ...IN_ATTESA, scade_il: "2026-11-21T11:00:00.000Z" }))].map((r) => rifiutata(r, /pagament/i)));
  c("spedisci: scaduto, fallito, rimborsato, da_incassare (in colonna) → rifiutata", [], ["scaduto", "fallito", "rimborsato", "da_incassare"].filter((s) => !rifiutata(va(sp({}), stripe({ stato_pagamento: s })), /pagament/i)));
  c("spedisci: pagato e rimborsato in parte → ok", [true, true], ["pagato", "rimborsato_in_parte"].map((s) => va(sp({}), stripe({ stato_pagamento: s })).ok));
  c("spedisci: da `nuovo` direttamente (decisione del capo progetto) e da `in_preparazione` → ok", [true, true], [va(sp({}), stripe({ status: "nuovo" })).ok, va(sp({}), stripe({ status: "in_preparazione" })).ok]);
  c("spedisci: già spedito → «nessun_cambio»; consegnato e annullato → rifiutata", [true, true, true], [rifiutata(va(sp({}), stripe({ status: "spedito" })), null, "nessun_cambio"), rifiutata(va(sp({}), stripe({ status: "consegnato" }))), rifiutata(va(sp({}), stripe({ status: "annullato" })))]);
  c("spedisci: `ordineId` diverso dall'ordine → rifiutata", true, rifiutata(A.costruisciAzione(sp({ ordineId: "00000000-0000-4000-8000-000000000002" }), stripe(), ADESSO)));
  // ordine vecchio: come oggi, motivo e corriere non si impongono (SPEC 8A n. 7)
  const sv = va({ azione: "spedisci" }, vecchio());
  c("spedisci su un ordine VECCHIO: nessun corriere obbligatorio, passa e mette `spedito`", [true, "spedito", ISO], [sv.ok, sv.patch.status, sv.patch.spedito_il]);
  c("spedisci su un ordine vecchio non toccato dai vincoli di pagamento: non pagato, annullato → passa come oggi", [true, true], [va({ azione: "spedisci" }, vecchio()).ok, va({ azione: "spedisci" }, vecchio({ status: "annullato" })).ok]);
  c("spedisci su un ordine vecchio con corriere e numero: li salva", ["BRT", "123456789012"], ((r) => [r.patch.corriere, r.patch.tracking])(va(sp({}), vecchio())));
  c("spedisci su un ordine vecchio già spedito → nessun_cambio", true, rifiutata(va({ azione: "spedisci" }, vecchio({ status: "spedito" })), null, "nessun_cambio"));

  // ══ annulla ═══════════════════════════════════════════════════════════════════════════════════════
  const an = (extra) => ({ azione: "annulla", motivo: "Il cliente ha cambiato idea", rimborso: "nessuno", rimettiInMagazzino: false, ...extra });
  const a1 = va(an({}));
  c("annulla (pagato, nessun rimborso, niente magazzino): patch con stato, motivo, data", [true, ["annullato_il", "annullo_motivo", "aggiornato_il", "status"].sort(), "annullato", "Il cliente ha cambiato idea", ISO], [a1.ok, chiavi(a1), a1.patch.status, a1.patch.annullo_motivo, a1.patch.annullato_il]);
  c("annulla: condizioni, evento «annullato» con motivo scelte e nessun effetto da eseguire", [{ status: "nuovo", stato_pagamento: "pagato" }, "annullato", "Il cliente ha cambiato idea", "nessuno", false, []], [a1.condizioni, a1.evento.tipo, a1.evento.dopo.motivo, a1.evento.dopo.rimborso, a1.evento.dopo.rimetti_in_magazzino, a1.effetti]);
  c("annulla: il motivo si taglia agli spazi", "Errore nostro", va(an({ motivo: "  Errore nostro  " })).patch.annullo_motivo);
  c("annulla SENZA motivo (assente, vuoto, solo spazi, non testo) → rifiutata", [true, true, true, true], [undefined, "", "     ", 42].map((m) => rifiutata(va(an({ motivo: m })), /motivo/i)));
  c("annulla: motivo di 501 caratteri → rifiutata; di 500 → ok", [true, true], [rifiutata(va(an({ motivo: "a".repeat(501) })), /motivo/i), va(an({ motivo: "a".repeat(500) })).ok]);
  c("annulla un ordine pagato SENZA la scelta «rimborsa/nessun rimborso» → rifiutata", [true, true, true], [undefined, "boh", true].map((v) => rifiutata(va(an({ rimborso: v })), /rimborso/i)));
  c("annulla un ordine pagato SENZA la scelta sul magazzino (assente, «no» in testo) → rifiutata", [true, true], [undefined, "no"].map((v) => rifiutata(va(an({ rimettiInMagazzino: v })), /magazzino/i)));
  const a2 = va(an({ rimborso: "ora", chiaveRichiesta: CHIAVE, rimettiInMagazzino: true }));
  c("annulla con «rimborsa ora» e magazzino sì: effetti = rimborso del massimo (2490) e giacenza da rimettere", [true, [{ tipo: "rimborso", importoCent: 2490, motivo: "Il cliente ha cambiato idea", chiaveRichiesta: CHIAVE }, { tipo: "giacenza_rimetti" }]], [a2.ok, a2.effetti]);
  c("annulla con «rimborsa ora»: l'importo è il massimo che resta (rimborsi riusciti e richiesti sottratti)", 990, va(an({ rimborso: "ora", chiaveRichiesta: CHIAVE }), stripe({ stato_pagamento: "rimborsato_in_parte" }), { rimborsi: [{ importoCent: 1000, stato: "richiesto" }, { importoCent: 500, stato: "riuscito" }] }).effetti[0].importoCent);
  c("annulla con «rimborsa ora» senza chiave di richiesta (o non UUID) → rifiutata", [true, true], [undefined, "abc"].map((k) => rifiutata(va(an({ rimborso: "ora", chiaveRichiesta: k })), /chiave|richiesta/i)));
  c("annulla: se non resta niente da rimborsare la scelta non serve e non si chiede", [true, []], ((r) => [r.ok, r.effetti])(va({ ...an({ rimborso: undefined }) }, stripe({ stato_pagamento: "rimborsato" }), { rimborsi: [{ importoCent: 2490, stato: "riuscito" }] })));
  c("annulla: se non resta niente da rimborsare ma il magazzino non è scelto → rifiutata", true, rifiutata(va(an({ rimborso: undefined, rimettiInMagazzino: undefined }), stripe({ stato_pagamento: "rimborsato" }), { rimborsi: [{ importoCent: 2490, stato: "riuscito" }] }), /magazzino/i));
  const a3 = va(an({ rimborso: undefined, rimettiInMagazzino: undefined }), stripe(IN_ATTESA));
  c("annulla un ordine IN ATTESA: niente scelte, e l'effetto è far scadere la sessione di Stripe", [true, [{ tipo: "scadi_sessione" }]], [a3.ok, a3.effetti]);
  c("annulla un ordine in attesa SENZA motivo → rifiutata comunque", true, rifiutata(va(an({ motivo: "" }), stripe(IN_ATTESA)), /motivo/i));
  c("annulla scaduto e fallito: ok, nessun effetto (la sessione è già chiusa)", [[true, []], [true, []]], ["scaduto", "fallito"].map((s) => { const r = va(an({ rimborso: undefined, rimettiInMagazzino: undefined }), stripe({ ...IN_ATTESA, stato_pagamento: s })); return [r.ok, r.effetti]; }));
  c("annulla: da `spedito` e `in_preparazione` con motivo → ok; consegnato → rifiutata", [true, true, true], [va(an({}), stripe({ status: "spedito" })).ok, va(an({}), stripe({ status: "in_preparazione" })).ok, rifiutata(va(an({}), stripe({ status: "consegnato" })))]);
  c("annulla un ordine già annullato → «nessun_cambio»", true, rifiutata(va(an({}), stripe({ status: "annullato" })), null, "nessun_cambio"));
  // ordine vecchio: motivo e scelte non si impongono
  const av = va({ azione: "annulla" }, vecchio({ pagato_il: "2026-11-20T10:00:00.000Z" }));
  c("annulla su un ordine VECCHIO: senza motivo né scelte, passa (come oggi)", [true, "annullato", ISO, []], [av.ok, av.patch.status, av.patch.annullato_il, av.effetti]);
  c("annulla su un ordine vecchio con motivo: lo salva; da `consegnato` passa come oggi", [true, "Doppione"], ((r) => [r.ok, r.patch.annullo_motivo])(va({ azione: "annulla", motivo: "Doppione" }, vecchio({ status: "consegnato" }))));

  // ══ rimborso ══════════════════════════════════════════════════════════════════════════════════════
  const ri = (extra) => ({ azione: "rimborso", importoCent: 1000, motivo: "Prodotto danneggiato", chiaveRichiesta: CHIAVE, conferma: true, ...extra });
  const r1 = va(ri({}));
  c("rimborso: ok, nessuna colonna da scrivere (lo fa shop_rimborso_prenota) e l'effetto porta i dati validati", [true, {}, [{ tipo: "rimborso", importoCent: 1000, motivo: "Prodotto danneggiato", chiaveRichiesta: CHIAVE }]], [r1.ok, r1.patch, r1.effetti]);
  c("rimborso: evento «rimborso_richiesto» con importo e motivo; condizioni sullo stato di pagamento", ["rimborso_richiesto", 1000, "Prodotto danneggiato", "pagato"], [r1.evento.tipo, r1.evento.dopo.importo_cent, r1.evento.dopo.motivo, r1.condizioni.stato_pagamento]);
  const prova = (nome, extra, regex, o, ctx) => c(`rimborso: ${nome} → rifiutato con la frase`, true, rifiutata(va(ri(extra), o, ctx), regex));
  prova("oltre il massimo", { importoCent: 2491 }, /al massimo/);
  prova("oltre il massimo tenendo conto dei rimborsi RICHIESTI", { importoCent: 500 }, /al massimo/, stripe(), { rimborsi: [{ importoCent: 2200, stato: "richiesto" }] });
  prova("importo 0", { importoCent: 0 }, /importo/i);
  prova("importo con decimali", { importoCent: 10.5 }, /importo|centesim/i);
  prova("motivo vuoto", { motivo: "" }, /motivo/i);
  prova("senza conferma", { conferma: false }, /conferm/i);
  prova("ordine in attesa", {}, /pagat/i, stripe(IN_ATTESA));
  prova("ordine vecchio", {}, /Stripe/, vecchio({ pagato_il: "2026-11-20T10:00:00.000Z", pagato_importo: 24.9 }));
  c("rimborso: la stessa frase di `controllaRimborso` (la schermata e il server non possono dire due cose)", true, (() => {
    const R = mod["ecommerce/rimborso"];
    const a = va(ri({ importoCent: 2491 }));
    return a.errore === R.controllaRimborso(ri({ importoCent: 2491 }), stripe(), []).errore;
  })());

  // ══ riconcilia ════════════════════════════════════════════════════════════════════════════════════
  const rc = va({ azione: "riconcilia" }, stripe(IN_ATTESA));
  c("riconcilia (ordine in attesa): ok, nessuna colonna, effetto «riconcilia»; evento «riconciliato»", [true, {}, [{ tipo: "riconcilia" }], "riconciliato"], [rc.ok, rc.patch, rc.effetti, rc.evento.tipo]);
  c("riconcilia: anche su pagato, scaduto, fallito e rimborsato (si rileggono i rimborsi)", [], ["pagato", "scaduto", "fallito", "rimborsato_in_parte", "rimborsato"].filter((s) => !va({ azione: "riconcilia" }, stripe({ stato_pagamento: s })).ok));
  c("riconcilia su un ordine vecchio → rifiutata (non passa da Stripe)", true, rifiutata(va({ azione: "riconcilia" }, vecchio()), /Stripe/));

  // ══ fattura_emessa ════════════════════════════════════════════════════════════════════════════════
  const fe = va({ azione: "fattura_emessa", nota: "Fattura 12/2026" }, stripe({ fattura_richiesta: true }));
  c("fattura_emessa: data e nota (col numero) sull'ordine", [true, ["aggiornato_il", "fattura_emessa_il", "fattura_nota"], ISO, "Fattura 12/2026", { fattura_emessa_il: null }], [fe.ok, chiavi(fe), fe.patch.fattura_emessa_il, fe.patch.fattura_nota, fe.condizioni]);
  c("fattura_emessa: senza nota passa (la nota resta vuota); nota di 501 caratteri → rifiutata", [true, null, true], [((r) => [r.ok, r.patch.fattura_nota])(va({ azione: "fattura_emessa" }, stripe({ fattura_richiesta: true }))), rifiutata(va({ azione: "fattura_emessa", nota: "a".repeat(501) }, stripe({ fattura_richiesta: true })), /nota/i)].flat());
  c("fattura_emessa: fattura non richiesta → rifiutata; già emessa → «nessun_cambio»", [true, true], [rifiutata(va({ azione: "fattura_emessa" }, stripe())), rifiutata(va({ azione: "fattura_emessa" }, stripe({ fattura_richiesta: true, fattura_emessa_il: "2026-11-21T08:00:00.000Z" })), null, "nessun_cambio")]);

  // ══ email_invia ═══════════════════════════════════════════════════════════════════════════════════
  const em = va({ azione: "email_invia", chiave: "spedito" });
  c("email_invia: ok, nessuna colonna, effetto «email» manuale con la chiave", [true, {}, [{ tipo: "email", chiave: "spedito", manuale: true }], "email_inviata"], [em.ok, em.patch, em.effetti, em.evento.tipo]);
  c("email_invia: le cinque chiavi dei modelli sì", [], ["conferma_ordine", "spedito", "pagamento_non_riuscito", "rimborso", "annullato"].filter((k) => !va({ azione: "email_invia", chiave: k }).ok));
  c("email_invia: chiave assente o che non è un modello → rifiutata", [true, true], [undefined, "newsletter"].map((k) => rifiutata(va({ azione: "email_invia", chiave: k }), /email|messaggio/i)));
  c("email_invia: ordine senza email → rifiutata; ordine vecchio → rifiutata", [true, true], [rifiutata(va({ azione: "email_invia", chiave: "spedito" }, stripe({ email: "" })), /email/i), rifiutata(va({ azione: "email_invia", chiave: "spedito" }, vecchio()))]);

  // ══ giacenza_verificata ═══════════════════════════════════════════════════════════════════════════
  const gv = va({ azione: "giacenza_verificata" }, stripe({ giacenza_da_verificare: true }));
  c("giacenza_verificata: toglie il segno; condizione = era ancora da verificare; evento", [true, ["aggiornato_il", "giacenza_da_verificare"], false, { giacenza_da_verificare: true }, "giacenza_verificata"], [gv.ok, chiavi(gv), gv.patch.giacenza_da_verificare, gv.condizioni, gv.evento.tipo]);
  c("giacenza_verificata: se non era da verificare → «nessun_cambio»", true, rifiutata(va({ azione: "giacenza_verificata" }), null, "nessun_cambio"));

  // ══ correggi_stato ════════════════════════════════════════════════════════════════════════════════
  const cs = (da, a, extra) => ({ azione: "correggi_stato", da, a, motivo: "Clic sbagliato", ...extra });
  const c1 = va(cs("spedito", "in_preparazione"), stripe({ status: "spedito", spedito_il: "2026-11-21T09:00:00.000Z" }));
  c("correggi_stato spedito → in_preparazione con motivo: ok, toglie la data di spedizione", [true, "in_preparazione", null, ["aggiornato_il", "spedito_il", "status"]], [c1.ok, c1.patch.status, c1.patch.spedito_il, chiavi(c1)]);
  c("correggi_stato: evento «stato_corretto» con da, a e motivo; condizioni sullo stato visto", ["stato_corretto", "spedito", "in_preparazione", "Clic sbagliato", { status: "spedito" }], [c1.evento.tipo, c1.evento.prima.stato, c1.evento.dopo.stato, c1.evento.dopo.motivo, c1.condizioni]);
  c("correggi_stato senza motivo (assente, vuoto, spazi) → rifiutato", [true, true, true], [undefined, "", "   "].map((m) => rifiutata(va(cs("spedito", "in_preparazione", { motivo: m }), stripe({ status: "spedito" })), /motivo/i)));
  c("correggi_stato in_preparazione → nuovo con motivo: ok", true, va(cs("in_preparazione", "nuovo"), stripe({ status: "in_preparazione" })).ok);
  const c2 = va(cs("annullato", "nuovo"), stripe({ status: "annullato", annullo_motivo: "x", annullato_il: "2026-11-21T09:00:00.000Z" }), { rimborsi: [] });
  c("correggi_stato annullato → nuovo: ok, toglie motivo e data dell'annullo", [true, "nuovo", null, null], [c2.ok, c2.patch.status, c2.patch.annullo_motivo, c2.patch.annullato_il]);
  c("correggi_stato annullato → nuovo con la giacenza già rimessa: segna la giacenza da verificare", true, va(cs("annullato", "nuovo"), stripe({ status: "annullato", giacenza_rimessa_il: "2026-11-21T09:00:00.000Z" })).patch.giacenza_da_verificare);
  c("correggi_stato annullato → nuovo con un rimborso RIUSCITO → rifiutato", true, rifiutata(va(cs("annullato", "nuovo"), stripe({ status: "annullato" }), { rimborsi: [{ importoCent: 1000, stato: "riuscito" }] }), /rimborso/i));
  c("correggi_stato annullato → nuovo con un rimborso RICHIESTO → rifiutato; con uno fallito → ok", [true, true], [rifiutata(va(cs("annullato", "nuovo"), stripe({ status: "annullato" }), { rimborsi: [{ importoCent: 1000, stato: "richiesto" }] }), /rimborso/i), va(cs("annullato", "nuovo"), stripe({ status: "annullato" }), { rimborsi: [{ importoCent: 1000, stato: "fallito" }] }).ok]);
  c("correggi_stato: i passi in avanti non sono correzioni (nuovo → spedito, in_preparazione → annullato) → rifiutati", [true, true], [rifiutata(va(cs("nuovo", "spedito"), stripe({ status: "nuovo" }))), rifiutata(va(cs("in_preparazione", "annullato"), stripe({ status: "in_preparazione" })))]);
  c("correggi_stato: da un stato diverso da quello dell'ordine → conflitto; consegnato → rifiutato", [true, true], [rifiutata(va(cs("spedito", "in_preparazione"), stripe({ status: "nuovo" })), null, "conflitto"), rifiutata(va(cs("consegnato", "spedito"), stripe({ status: "consegnato" })))]);
  c("correggi_stato su un ordine vecchio → rifiutato (per lui c'è il cambio di stato libero)", true, rifiutata(va(cs("spedito", "in_preparazione"), vecchio({ status: "spedito" })), /stato/i));

  // ══ le cinque azioni vecchie su un ordine con `stato_pagamento` (bloccante 3) ═══════════════════════
  const pagatoVecchia = { azione: "pagato", metodo: "bonifico" };
  c("`pagato` vecchio su un ordine IN ATTESA → rifiutato, nessun `pagato_il` scritto", [true, true], ((r) => [rifiutata(r, /Controlla con Stripe/), !r.patch])(va(pagatoVecchia, stripe(IN_ATTESA))));
  c("`pagato` vecchio su ogni stato di pagamento valorizzato (anche da_incassare e pagato) → rifiutato", [], P.STATI_PAGAMENTO.filter((s) => !rifiutata(va(pagatoVecchia, stripe({ stato_pagamento: s, pagato_il: null })), /Controlla con Stripe/)));
  c("`pagamento_annullato` su un ordine pagato Stripe → rifiutato", true, rifiutata(va({ azione: "pagamento_annullato" }, stripe()), /Controlla con Stripe/));
  c("`tracking` vecchio su un ordine Stripe → rifiutato («usa Spedisci»)", true, rifiutata(va({ azione: "tracking", valore: "ABC123456" }), /Spedisci/));
  c("`stato → spedito` su un ordine Stripe → rifiutato («usa Spedisci»); `stato → annullato` → rifiutato («usa Annulla»)", [true, true], [rifiutata(va({ azione: "stato", da: "nuovo", a: "spedito" }), /Spedisci/), rifiutata(va({ azione: "stato", da: "nuovo", a: "annullato" }), /Annulla/)]);
  c("`nota_interna` su un ordine Stripe → passa", [true, "Chiamare il cliente"], ((r) => [r.ok, r.patch.note_interne])(va({ azione: "nota_interna", valore: "Chiamare il cliente" }, stripe(IN_ATTESA))));
  c("`stato` che non è spedito né annullato su un ordine Stripe pagato: nuovo → in_preparazione, spedito → consegnato → passano", [true, true], [va({ azione: "stato", da: "nuovo", a: "in_preparazione" }).ok, va({ azione: "stato", da: "spedito", a: "consegnato" }, stripe({ status: "spedito" })).ok]);
  c("`stato` su un ordine Stripe in attesa (non si prepara quello che non è pagato) → rifiutato", true, rifiutata(va({ azione: "stato", da: "nuovo", a: "in_preparazione" }, stripe(IN_ATTESA)), /pagament/i));
  c("`stato` che salta un passo o torna indietro su un ordine Stripe → rifiutato (all'indietro: «Correggi lo stato»)", [true, true], [rifiutata(va({ azione: "stato", da: "nuovo", a: "consegnato" })), rifiutata(va({ azione: "stato", da: "in_preparazione", a: "nuovo" }, stripe({ status: "in_preparazione" })), /motivo|Correggi/i)]);
  // ordine VECCHIO: tutto come oggi
  const OLD = (extra) => vecchio({ pagato_il: null, ...extra });
  c("VECCHIO: `pagato` passa e scrive `pagato_il`", [true, "bonifico", ISO], ((r) => [r.ok, r.patch.metodo_pagamento, r.patch.pagato_il])(va(pagatoVecchia, OLD())));
  c("VECCHIO: `pagamento_annullato` su un ordine pagato passa", true, va({ azione: "pagamento_annullato" }, vecchio({ pagato_il: "2026-11-20T10:00:00.000Z", pagato_importo: 24.9 })).ok);
  c("VECCHIO: `tracking` passa", [true, "ABC123456"], ((r) => [r.ok, r.patch.tracking])(va({ azione: "tracking", valore: "ABC123456" }, OLD())));
  c("VECCHIO: `stato` qualunque → qualunque: consegnato → nuovo, annullato → spedito, nuovo → spedito, nuovo → annullato", [true, true, true, true], [
    va({ azione: "stato", da: "consegnato", a: "nuovo" }, OLD({ status: "consegnato" })).ok, va({ azione: "stato", da: "annullato", a: "spedito" }, OLD({ status: "annullato" })).ok,
    va({ azione: "stato", da: "nuovo", a: "spedito" }, OLD()).ok, va({ azione: "stato", da: "nuovo", a: "annullato" }, OLD()).ok]);
  c("VECCHIO: ordine con la colonna sporca («boh») si tratta da vecchio", true, va({ azione: "stato", da: "nuovo", a: "spedito" }, OLD({ stato_pagamento: "boh" })).ok);

  // ══ la tabella di evasione (decisione del capo progetto) ═══════════════════════════════════════════
  const ev = (da, a, o) => P.passaggioEvasione(da, a, o);
  c("PASSAGGI_EVASIONE: nuovo → spedito ammesso, senza motivo", [true, false], ((r) => [r.ok, r.serveMotivo])(ev("nuovo", "spedito")));
  c("PASSAGGI_EVASIONE: gli altri passi non cambiano (in_preparazione → consegnato no, nuovo → consegnato no, in avanti un passo gli altri sì)", [false, false, true, true, true], [ev("in_preparazione", "consegnato").ok, ev("nuovo", "consegnato").ok, ev("nuovo", "in_preparazione").ok, ev("in_preparazione", "spedito").ok, ev("spedito", "consegnato").ok]);
  c("PASSAGGI_EVASIONE: da nuovo ora si va a in_preparazione, spedito, annullato (con motivo)", ["in_preparazione:false", "spedito:false", "annullato:true"], P.PASSAGGI_EVASIONE.nuovo.map((p) => `${p.a}:${p.motivo}`));

  // ══ puoRiprovare e annullato (decisione del capo progetto) ═════════════════════════════════════════
  c("puoRiprovare: un ordine annullato non si riapre mai (fallito o scaduto che sia)", [false, false, true, true], [
    P.puoRiprovare(stripe({ stato_pagamento: "fallito", status: "annullato" })), P.puoRiprovare(stripe({ stato_pagamento: "scaduto", status: "annullato" })),
    P.puoRiprovare(stripe({ stato_pagamento: "fallito" })), P.puoRiprovare(stripe({ stato_pagamento: "scaduto" }))]);
  c("puoRiprovare: gli altri stati come prima (in_attesa, pagato, rimborsato, da_incassare → no)", [], ["in_attesa", "pagato", "rimborsato", "rimborsato_in_parte", "da_incassare"].filter((s) => P.puoRiprovare(stripe({ stato_pagamento: s }))));

  // ══ in generale ═══════════════════════════════════════════════════════════════════════════════════
  c("CHIAVI_PATCH guadagna le colonne nuove e perde niente", [[], true], [["status", "pagato_il", "pagato_importo", "metodo_pagamento", "tracking", "note_interne", "lead_id", "senza_lead", "aggiornato_il"].filter((k) => !A.CHIAVI_PATCH.includes(k)),
    ["spedito_il", "corriere", "tracking_url", "senza_tracking", "annullo_motivo", "annullato_il", "fattura_emessa_il", "fattura_nota", "giacenza_da_verificare"].every((k) => A.CHIAVI_PATCH.includes(k))]);
  const tutte = [va(sp({})), a1, a2, a3, r1, rc, fe, em, gv, c1, c2, sv, av];
  c("ogni patch scrive SOLO colonne della lista bianca", [], tutte.flatMap((r) => Object.keys(r.patch)).filter((k) => !A.CHIAVI_PATCH.includes(k)));
  c("ogni azione riuscita porta `aggiornato_il` quando scrive qualcosa", [], tutte.filter((r) => Object.keys(r.patch).length && r.patch.aggiornato_il !== ISO));
  c("nessuna azione si chiama o contiene elimina/cancella/delete", [], ["elimina", "cancella", "delete", "elimina_ordine", "cancella_ordine", "rimuovi"].filter((nome) => A.costruisciAzione({ azione: nome, ordineId: ID }, stripe(), ADESSO).motivo !== "azione_sconosciuta"));
  c("nel sorgente di azioni.ts nessun nome di azione con elimina/cancella/delete", false, /azione:\s*["'](elimina|cancella|delete)/i.test(src));
  c("un'azione che non esiste → «azione_sconosciuta» (anche con il contesto)", true, rifiutata(A.costruisciAzione({ azione: "boh", ordineId: ID }, stripe(), ADESSO, { rimborsi: [] }), null, "azione_sconosciuta"));
  c("richiesta che non è un oggetto o ordineId sbagliato → rifiutata per ogni azione nuova", [], ["spedisci", "annulla", "rimborso", "riconcilia", "fattura_emessa", "email_invia", "giacenza_verificata", "correggi_stato"].filter((nome) => !rifiutata(A.costruisciAzione({ azione: nome, ordineId: "00000000-0000-4000-8000-0000000000ff" }, stripe(), ADESSO))));
  c("contesto assente o strano (rimborsi non elenco, corrieri non elenco) non fa lanciare", false, (() => { try { va(an({ rimborso: "ora", chiaveRichiesta: CHIAVE }), stripe(), { rimborsi: "boh", corrieri: 7 }); va(sp({}), stripe(), { corrieri: null }); return false; } catch { return true; } })());
  c("modulo puro: nessun import di React, Supabase o rete", false, /from\s+["'](react|@supabase|@\/integrations)|fetch\(|supabase/i.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")));
}
