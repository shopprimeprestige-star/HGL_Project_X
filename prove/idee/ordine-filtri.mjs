/** ── PROVE: L'ORDINE DI «RICONTATTI» E «ATTESA ACCONTO», UN TASTO CHE LO INVERTE (28/11/2026) ──
 *  Richiesta del titolare: «sia attesa a conto che ricontatti fai che posso mettere il filtro che li
 *  ordina dal più vecchio al più nuovo o dal più nuovo al più vecchio. Basta cliccare e si imposta.»
 *  Regole in src/crm/chatwa/ordineFiltri.ts (verso, memoria), ordineWhatsapp.ts e ricontatti.ts (i due
 *  ordinamenti); il tasto è in ElencoChat.tsx / TastoOrdine.tsx. Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveOrdineFiltri(mod, { c, gruppo, radice }) {
  const O = mod["chatwa/ordineFiltri"];
  const W = mod["chatwa/ordineWhatsapp"];
  const R = mod["chatwa/ricontatti"];
  const F = mod["chatwa/filtri"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");

  let n = 0;
  /** `o.arrivo`: data del lead (per «Ricontatti»); `o.ultimo`: ultimo messaggio (per «Attesa acconto»). */
  const chat = (o = {}) => {
    n++;
    return {
      phone: `+39333444${String(n).padStart(4, "0")}`,
      lead: { data: { stato: o.stato ?? "sta_valutando", consulenteId: "io", createdAt: o.arrivo } },
      lastMessage: o.ultimo ? { direction: "inbound", created_at: o.ultimo } : null,
      contact: { ultimo_messaggio_il: o.ultimo ?? null },
    };
  };
  const tel = (righe) => righe.map((r) => r.phone);

  // ── «Ricontatti»: la data è l'arrivo del lead ─────────────────────────────────────────────────
  gruppo("ORDINE FILTRI: RICONTATTI (data d'arrivo del lead)");
  const r1 = chat({ arrivo: "2026-11-20T10:00:00.000Z" });
  const r2 = chat({ arrivo: "2026-11-10T10:00:00.000Z" });
  const r3 = chat({ arrivo: "2026-11-01T10:00:00.000Z" });
  const rSenza = chat({});
  const mischiate = [r2, rSenza, r3, r1];
  c("di partenza (nessun verso): dal più nuovo, come prima", tel([r1, r2, r3, rSenza]), tel(R.ordinaRicontatti(mischiate)));
  c("«nuovi» è uguale all'ordine di partenza", tel(R.ordinaRicontatti(mischiate)), tel(R.ordinaRicontatti(mischiate, "nuovi")));
  c("«vecchi»: dal più vecchio, senza data sempre in fondo", tel([r3, r2, r1, rSenza]), tel(R.ordinaRicontatti(mischiate, "vecchi")));
  const pari1 = chat({ arrivo: "2026-11-05T10:00:00.000Z" });
  const pari2 = chat({ arrivo: "2026-11-05T10:00:00.000Z" });
  const pari3 = chat({ arrivo: "2026-11-05T10:00:00.000Z" });
  c("a pari data l'ordine resta stabile (nuovi)", tel([pari2, pari1, pari3]), tel(R.ordinaRicontatti([pari2, pari1, pari3], "nuovi")));
  c("a pari data l'ordine resta stabile anche invertito (non si rovescia)", tel([pari2, pari1, pari3]), tel(R.ordinaRicontatti([pari2, pari1, pari3], "vecchi")));
  const prio = chat({ arrivo: "2026-01-01T10:00:00.000Z" });
  prio.lead.data.ricontattoPrioritaIl = "2026-11-25T08:00:00.000Z";
  c("la priorità (puntina) resta in cima anche invertito", tel([prio, r3, r2, r1]), tel(R.ordinaRicontatti([r1, r2, prio, r3], "vecchi")));
  const ingresso = [r2, r1];
  R.ordinaRicontatti(ingresso, "vecchi");
  c("non muta l'ingresso", tel([r2, r1]), tel(ingresso));

  // ── «Attesa acconto»: l'ultimo messaggio (l'ordine generico della chat, com'è oggi) ───────────
  gruppo("ORDINE FILTRI: ATTESA ACCONTO (ultimo messaggio, come oggi)");
  const a1 = chat({ stato: "in_attesa_acconto", ultimo: "2026-11-27T10:00:00.000Z" });
  const a2 = chat({ stato: "in_attesa_acconto", ultimo: "2026-11-20T10:00:00.000Z" });
  const a3 = chat({ stato: "in_attesa_acconto", ultimo: "2026-11-02T10:00:00.000Z" });
  const aVuota = chat({ stato: "in_attesa_acconto" });
  const mix = [a3, aVuota, a1, a2];
  c("di partenza: dal più recente, senza messaggi in fondo (invariato)", tel([a1, a2, a3, aVuota]), tel(W.ordinaComeWhatsapp(mix)));
  c("«nuovi» è uguale all'ordine di partenza", tel(W.ordinaComeWhatsapp(mix)), tel(W.ordinaComeWhatsapp(mix, "nuovi")));
  c("«vecchi»: dal più vecchio, senza messaggi sempre in fondo", tel([a3, a2, a1, aVuota]), tel(W.ordinaComeWhatsapp(mix, "vecchi")));
  const p1 = chat({ ultimo: "2026-11-15T10:00:00.000Z" });
  const p2 = chat({ ultimo: "2026-11-15T10:00:00.000Z" });
  const p3 = chat({ ultimo: "2026-11-15T10:00:00.000Z" });
  c("a pari ora l'ordine resta stabile (nuovi)", tel([p3, p1, p2]), tel(W.ordinaComeWhatsapp([p3, p1, p2], "nuovi")));
  c("a pari ora l'ordine resta stabile anche invertito", tel([p3, p1, p2]), tel(W.ordinaComeWhatsapp([p3, p1, p2], "vecchi")));
  const ing2 = [a3, a1];
  W.ordinaComeWhatsapp(ing2, "vecchi");
  c("non muta l'ingresso", tel([a3, a1]), tel(ing2));

  // ── Quando compare il tasto, e cosa conta ─────────────────────────────────────────────────────
  gruppo("ORDINE FILTRI: QUANDO COMPARE IL TASTO");
  const acceso = (campo, valore) => F.commuta(F.FILTRI_VUOTI, campo, valore);
  c("filtri spenti: nessun tasto", null, O.filtroConOrdine(F.FILTRI_VUOTI));
  c("«Ricontatti» acceso: il tasto è quello dei ricontatti", "ricontatti", O.filtroConOrdine(acceso("ricontatti", true)));
  c(
    "«Attesa acconto» acceso: il tasto è quello dell'acconto",
    "acconto",
    O.filtroConOrdine(acceso(F.VOCE_ATTESA_ACCONTO.campo, F.VOCE_ATTESA_ACCONTO.valore)),
  );
  c(
    "gli altri filtri non hanno il tasto",
    [null, null, null, null, null, null, null],
    [
      O.filtroConOrdine(acceso("coda", "da-rispondere")),
      O.filtroConOrdine(acceso("coda", "da-chiamare")),
      O.filtroConOrdine(acceso("stelle", true)),
      O.filtroConOrdine(acceso("fase", "per-ora-no")),
      O.filtroConOrdine(acceso("fase", "stato:sta_valutando")),
      O.filtroConOrdine(acceso("acconto", true)),
      O.filtroConOrdine(acceso("tipo", "cliente")),
    ],
  );
  c("il consulente da solo non lo accende", null, O.filtroConOrdine({ ...F.FILTRI_VUOTI, consulente: "x" }));
  c("il tasto non conta sul contatore «Filtri»", 1, F.contaAccesi(acceso("ricontatti", true)));
  c("lo stato dell'ordine non è nei filtri (nessun campo nuovo)", Object.keys(F.FILTRI_VUOTI).sort(), [
    "acconto", "coda", "consulente", "fase", "finestra", "giorno", "io", "rEsito", "ricontatti", "stelle", "tipo",
  ]);

  // ── Il verso: testi e inversione ──────────────────────────────────────────────────────────────
  gruppo("ORDINE FILTRI: IL VERSO");
  c("si parte dal più nuovo per tutti e due", { ricontatti: "nuovi", acconto: "nuovi" }, O.ORDINE_DI_PARTENZA);
  c("un clic inverte, un altro riporta", ["vecchi", "nuovi"], [O.invertiVerso("nuovi"), O.invertiVerso("vecchi")]);
  c("i testi dicono l'ordine attuale", ["Dal più nuovo", "Dal più vecchio"], [O.TESTO_VERSO.nuovi, O.TESTO_VERSO.vecchi]);

  // ── La scelta si ricorda, per ciascun filtro ──────────────────────────────────────────────────
  gruppo("ORDINE FILTRI: LA SCELTA SI RICORDA");
  const salvato = O.scriviOrdine({ ricontatti: "vecchi", acconto: "nuovi" });
  c("si rilegge com'era scritta", { ricontatti: "vecchi", acconto: "nuovi" }, O.leggiOrdine(salvato));
  c("per ciascun filtro: l'altro non si muove", { ricontatti: "nuovi", acconto: "vecchi" }, O.leggiOrdine(O.scriviOrdine({ ricontatti: "nuovi", acconto: "vecchi" })));
  c("niente salvato: si parte da quello di oggi", O.ORDINE_DI_PARTENZA, O.leggiOrdine(null));
  c("testo rotto: si parte da quello di oggi, senza errori", O.ORDINE_DI_PARTENZA, O.leggiOrdine("{non è json"));
  c("valori che non si riconoscono: ignorati uno a uno", { ricontatti: "vecchi", acconto: "nuovi" }, O.leggiOrdine('{"ricontatti":"vecchi","acconto":"a-caso"}'));
  c("un array o un numero non rompono niente", [O.ORDINE_DI_PARTENZA, O.ORDINE_DI_PARTENZA], [O.leggiOrdine("[1,2]"), O.leggiOrdine("7")]);

  // ── Il collegamento (sul sorgente: il disegno si guarda aprendo la pagina) ────────────────────
  gruppo("ORDINE FILTRI: COLLEGAMENTO");
  const elenco = senzaCommenti(leggi("src/crm/chatwa/ElencoChat.tsx"));
  const tasto = senzaCommenti(leggi("src/crm/chatwa/TastoOrdine.tsx"));
  const memoria = senzaCommenti(leggi("src/crm/chatwa/useFiltriChat.ts"));
  c("l'elenco passa il verso a «Ricontatti» e a «Tutte»", true, /ordinaRicontatti\(trovate, verso\)/.test(elenco) && /ordinaComeWhatsapp\([\s\S]{0,120}?verso,?\s*\)/.test(elenco));
  c("il tasto compare solo con un filtro che lo ha", true, /filtroOrdine\s*&&\s*\(\s*<TastoOrdine/.test(elenco));
  c("il tasto è un bottone con aria-label e il testo dell'ordine attuale", true, /<button/.test(tasto) && /aria-label=/.test(tasto) && /TESTO_VERSO\[/.test(tasto));
  c("tocco da 44 px sul telefono, 32 dal mouse", true, /h-11/.test(tasto) && /lg:pointer-fine:h-8/.test(tasto));
  c("non va a capo a metà: il testo non si spezza", true, /whitespace-nowrap/.test(tasto));
  c("la memoria è sul dispositivo, con try/catch (la pagina va anche senza)", true, /hgl_chat_ordine_v1/.test(memoria) && /localStorage/.test(memoria) && /try\s*{/.test(memoria));
}
