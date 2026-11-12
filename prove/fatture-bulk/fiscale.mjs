/** ── FATTURE BULK · T5 · «IMPORTO PAGATO → FATTURA» E REGOLE DI LOTTO ──────
 *  La parte fiscale: `fatturaDaRiga`, `totaleNelFile`, `avvisoTotaleXml`,
 *  `ultimoGiornoUtile` (da-importo-a-fattura.ts); `controllaLotto`,
 *  `firmaImpostazioni`, `righeRiepilogoCommercialista` (regole-lotto.ts).
 *  Allineata a NOTE-FISCALI (R1-R11, R15, R18) e VERIFICA-FISCALE (punti 1-7).
 *  ⚠️ Dati inventati: azienda e clienti di fantasia, P.IVA con cifra di controllo
 *   calcolata qui, CF col controllo di dati.mjs. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CF_PROVA } from "./dati.mjs";

/** Dieci cifre + la cifra di controllo (lo stesso algoritmo di `partitaIvaValida`). */
function pivaConControllo(dieci) {
  let s = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(dieci[i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    s += d;
  }
  return dieci + String((10 - (s % 10)) % 10);
}
const PIVA = pivaConControllo("1234567001");

const AZIENDA = {
  denominazione: "ESEMPIO CAPELLI S.R.L.", partitaIva: PIVA, codiceFiscale: PIVA, regimeFiscale: "RF01",
  indirizzo: "Via dei Ciliegi", civico: "5", cap: "20100", comune: "Milano", provincia: "MI", nazione: "IT",
  reaUfficio: "", reaNumero: "", pec: "esempio@pec.example", iban: "IT60X0542811101000000123456",
  aliquotaPredefinita: 22, primoNumero: 1, annoNumerazione: 2026, serie: "",
};
const campi = (extra = {}) => ({
  nome: "Lucia", cognome: "Verdi", codiceFiscale: CF_PROVA, indirizzo: "Via dei Tigli 4", cap: "20100",
  comune: "Milano", provincia: "MI", importo: 104, data: "2026-03-15", modo: "bonifico", riferimento: "", ...extra,
});
const ingresso = (extra = {}) => ({
  campi: campi(), azienda: AZIENDA, lotto: "lotto-0123abcd", idRiga: "0003-0004-0005",
  descrizione: "", leadId: null, numeroProvvisorio: 7, impronte: ["h1", "h2", "h3"], adesso: "2026-11-12T10:00:00.000Z", ...extra,
});
const cents = (n) => Math.round(n * 100);
const sigle = (motivi) => motivi.map((m) => `${m.codice}:${m.gravita}`);

function congela(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) congela(v);
  }
  return o;
}
const lancia = (f) => { try { f(); return ""; } catch (e) { return e instanceof Error ? e.message : String(e); } };
/** Il totale come lo scrive il file, letto dal testo (indipendente dal codice sotto prova). */
const totaleDalTesto = (xml) => Number(/<ImportoTotaleDocumento>([\d.]+)<\/ImportoTotaleDocumento>/.exec(xml)?.[1]);

export async function prove(mod, { c, gruppo, radice }) {
  const F = mod["fatture/bulk/da-importo-a-fattura"];
  const L = mod["fatture/bulk/regole-lotto"];
  const X = mod["fatture/xml"];
  const CONTI = mod["fatture/conti"];
  const MODI = mod["fatture/modi-di-incasso"];
  const { DESCRIZIONI } = mod["fatture/descrizioni"];

  gruppo("BULK · T5 · I CONTI · IMPORTO PAGATO = TOTALE, UNA RIGA SOLA");
  const importi = [104, 107, 0.01, 0.03, 999.99, 1234.56];
  for (const aliquota of [22, 10, 4]) {
    const az = { ...AZIENDA, aliquotaPredefinita: aliquota };
    const quadra = [];
    const unaRiga = [];
    const comeContoDaLordo = [];
    for (const importo of importi) {
      const f = F.fatturaDaRiga(ingresso({ azienda: az, campi: campi({ importo }) }));
      quadra.push(cents(f.imponibile + f.imposta) === cents(importo) && cents(f.totale) === cents(importo));
      unaRiga.push(f.righe.length === 1 && f.righe[0].quantita === 1 && f.righe[0].aliquota === aliquota && f.righe[0].prezzoUnitario === f.imponibile);
      const k = CONTI.contoDaLordo(importo, aliquota);
      comeContoDaLordo.push([f.imponibile, f.imposta, f.totale]);
      comeContoDaLordo[comeContoDaLordo.length - 1] = JSON.stringify([f.imponibile, f.imposta, f.totale]) === JSON.stringify([k.imponibile, k.imposta, k.totale]);
    }
    c(`IVA ${aliquota}%: imponibile + imposta = totale = pagato, per tutti gli importi`, importi.map(() => true), quadra);
    c(`IVA ${aliquota}%: una riga sola, quantità 1, prezzo = imponibile, aliquota dell'azienda`, importi.map(() => true), unaRiga);
    c(`IVA ${aliquota}%: gli stessi numeri di contoDaLordo (nessun secondo modo di calcolare)`, importi.map(() => true), comeContoDaLordo);
  }

  gruppo("BULK · T5 · IL CENTESIMO DELL'XML (R10): SI DOCUMENTA, NON SI CORREGGE");
  const f104 = F.fatturaDaRiga(ingresso({ campi: campi({ importo: 104 }) }));
  c("pagato 104,00 → imponibile 85,25 + IVA 18,75 (per differenza)", [85.25, 18.75, 104], [f104.imponibile, f104.imposta, f104.totale]);
  c("il file dice 104,01 (xml.ts ricalcola l'IVA: difetto già presente, non toccato)", 104.01, F.totaleNelFile(f104, AZIENDA));
  const av = F.avvisoTotaleXml(f104, AZIENDA);
  c("l'avviso c'è, è un avviso e non ferma niente", ["totale_xml_diverso", "avviso"], [av?.codice, av?.gravita]);
  c("dice le due cifre", [true, true], [av?.testo.includes("104,01"), av?.testo.includes("104,00")]);
  const f100 = F.fatturaDaRiga(ingresso({ campi: campi({ importo: 100 }) }));
  c("dove il file torna uguale al pagato: nessun avviso", [F.totaleNelFile(f100, AZIENDA), F.avvisoTotaleXml(f100, AZIENDA)], [totaleDalTesto(X.costruisciXml(f100, AZIENDA)), null]);
  // Coerenza su un campione: l'avviso c'è se e solo se il testo dell'XML dice un totale diverso dal pagato.
  let incoerenti = 0, conAvviso = 0, campione = 0;
  for (let k = 1; k <= 400; k++) {
    const importo = (k * 797) % 300000 / 100 + 0.01;
    const f = F.fatturaDaRiga(ingresso({ campi: campi({ importo: Math.round(importo * 100) / 100 }) }));
    const nelFile = totaleDalTesto(X.costruisciXml(f, AZIENDA));
    const diverso = cents(nelFile) !== cents(f.totale);
    campione++;
    if (diverso) conAvviso++;
    if (F.totaleNelFile(f, AZIENDA) !== nelFile || (F.avvisoTotaleXml(f, AZIENDA) !== null) !== diverso) incoerenti++;
  }
  c(`su ${campione} importi: totaleNelFile = il testo del file e l'avviso c'è solo dove serve`, 0, incoerenti);
  c("e il difetto esiste davvero nel campione (altrimenti la prova non prova)", true, conAvviso > 20 && conAvviso < campione);

  gruppo("BULK · T5 · DATA, ANNO, TIPO, CLIENTE");
  const f = F.fatturaDaRiga(ingresso());
  c("data e data del pagamento = la data letta, mai oggi", ["2026-03-15", "2026-03-15"], [f.data, f.dataPagamento]);
  c("anno e numero provvisorio", [2026, 7, "emessa"], [f.anno, f.numero, f.stato]);
  c("serie dell'azienda", "A", F.fatturaDaRiga(ingresso({ azienda: { ...AZIENDA, serie: "A" } })).serie);
  c("a cavallo d'anno: il 30 dicembre resta dell'anno vecchio", [2025, "2025-12-30"], ((x) => [x.anno, x.data])(F.fatturaDaRiga(ingresso({ campi: campi({ data: "2025-12-30" }) }))));
  c("29/02/2028 esiste", "2028-02-29", F.fatturaDaRiga(ingresso({ campi: campi({ data: "2028-02-29" }) })).data);
  c("29/02/2027 non esiste → rifiutata", true, lancia(() => F.fatturaDaRiga(ingresso({ campi: campi({ data: "2027-02-29" }) }))).length > 0);
  c("tipo sempre «unica»", "unica", f.tipo);
  c("acconto rifiutato", true, lancia(() => F.fatturaDaRiga(ingresso({ tipo: "acconto" }))).length > 0);
  c("saldo rifiutato", true, lancia(() => F.fatturaDaRiga(ingresso({ tipo: "saldo" }))).length > 0);
  c("«unica» esplicito va bene", "unica", F.fatturaDaRiga(ingresso({ tipo: "unica" })).tipo);
  c("cliente: privato italiano, codice destinatario 0000000, nessuna PEC, civico vuoto (sta nell'indirizzo)",
    { azienda: false, nazione: "IT", codiceDestinatario: "0000000", pec: "", civico: "", partitaIva: "", denominazione: "" },
    { azienda: f.cliente.azienda, nazione: f.cliente.nazione, codiceDestinatario: f.cliente.codiceDestinatario, pec: f.cliente.pec, civico: f.cliente.civico, partitaIva: f.cliente.partitaIva, denominazione: f.cliente.denominazione });
  c("cliente: i dati della riga", ["Lucia", "Verdi", CF_PROVA, "Via dei Tigli 4", "20100", "Milano", "MI"],
    [f.cliente.nome, f.cliente.cognome, f.cliente.codiceFiscale, f.cliente.indirizzo, f.cliente.cap, f.cliente.comune, f.cliente.provincia]);
  c("il CF entra in maiuscolo e senza spazi", CF_PROVA, F.fatturaDaRiga(ingresso({ campi: campi({ codiceFiscale: ` ${CF_PROVA.toLowerCase()} ` }) })).cliente.codiceFiscale);
  c("nome cliente per l'elenco", "Lucia Verdi", f.leadNome);
  c("nessun preventivo, nessuna email d'origine", ["", undefined], [f.preventivoRef, f.emailOrigine]);
  c("con adesso uguale, stesso risultato (determinismo)", f, F.fatturaDaRiga(ingresso()));

  gruppo("BULK · T5 · COME HA PAGATO · IL CODICE MP VIENE DALLA CONFIGURAZIONE ESISTENTE");
  const mp = {};
  for (const modo of ["bonifico", "pos", "carta", "contanti"]) {
    const fm = F.fatturaDaRiga(ingresso({ campi: campi({ modo }) }));
    mp[modo] = [fm.metodoPagamento, MODI.codiceDelModo(fm.metodoPagamento)];
  }
  c("bonifico MP05, pos e carta MP08, contanti MP01", { bonifico: ["bonifico", "MP05"], pos: ["pos", "MP08"], carta: ["carta", "MP08"], contanti: ["contanti", "MP01"] }, mp);
  c("modo mancante → errore, mai un bonifico di ripiego", true, lancia(() => F.fatturaDaRiga(ingresso({ campi: campi({ modo: "" }) }))).length > 0);
  for (const strano of ["paypal", "satispay", "altro", "assegno"])
    c(`${strano} → errore (bloccato finché il commercialista non risponde)`, true, lancia(() => F.fatturaDaRiga(ingresso({ campi: campi({ modo: strano }) }))).length > 0);
  c("riferimento vuoto va bene (mai obbligatorio)", "", F.fatturaDaRiga(ingresso({ campi: campi({ modo: "pos", riferimento: "" }) })).riferimentoPagamento);
  c("il riferimento entra senza spazi attorno", "CRO123456", F.fatturaDaRiga(ingresso({ campi: campi({ riferimento: "  CRO123456 " }) })).riferimentoPagamento);

  gruppo("BULK · T5 · DESCRIZIONE E CAUSALE");
  c("descrizione vuota → la prima dell'elenco", DESCRIZIONI[0], f.righe[0].descrizione);
  c("una delle altre dell'elenco → quella", DESCRIZIONI[1], F.fatturaDaRiga(ingresso({ descrizione: DESCRIZIONI[1] })).righe[0].descrizione);
  c("un testo libero fuori elenco → rifiutato (la descrizione resta neutra, D15.5)", true, lancia(() => F.fatturaDaRiga(ingresso({ descrizione: "Protesi per alopecia, detraibile" }))).length > 0);
  c("descrizioneAmmessa: vuota e dell'elenco sì, il resto no", [true, true, false], [F.descrizioneAmmessa(""), F.descrizioneAmmessa(DESCRIZIONI[2]), F.descrizioneAmmessa("Parrucca detraibile")]);
  const salute = /salut|sanit|detra|diagnos|prescri|patolog|malatt|medic|terap|alopec|tumor|oncolog|chemio|\bAD\b|\bPI\b|\bAA\b|articol|art\.\s?\d|dpr/i;
  c("nessuna descrizione dell'elenco parla di salute, detrazione o articoli di legge", [], DESCRIZIONI.filter((d) => salute.test(d)));
  const causali = ["bonifico", "pos", "carta", "contanti"].map((modo) => F.fatturaDaRiga(ingresso({ campi: campi({ modo, riferimento: "OP123456" }) })).causale);
  c("causale: bonifico = descrizione; pos, carta, contanti = descrizione + come ha pagato + operazione",
    [DESCRIZIONI[0], `${DESCRIZIONI[0]} · pagato al POS · operazione OP123456`, `${DESCRIZIONI[0]} · pagato con carta · operazione OP123456`, `${DESCRIZIONI[0]} · pagato in contanti · operazione OP123456`], causali);
  c("causale = causaleSuggerita (stessa funzione di oggi)", MODI.causaleSuggerita({ metodo: "pos", base: DESCRIZIONI[0], riferimento: "OP123456" }), causali[1]);
  c("nessuna causale parla di salute", [], causali.filter((d) => salute.test(d)));
  c("la riga ha la stessa descrizione della causale (base)", true, causali[0] === F.fatturaDaRiga(ingresso({ campi: campi({ modo: "bonifico", riferimento: "OP123456" }) })).righe[0].descrizione);

  gruppo("BULK · T5 · LA SCHEDA, L'ORIGINE, LE CHIAVI");
  c("scheda abbinata → leadId = la scheda", "scheda-42", F.fatturaDaRiga(ingresso({ leadId: "scheda-42" })).leadId);
  c("senza scheda → bulk:<lotto>:<riga>", "bulk:lotto-0123abcd:0003-0004-0005", f.leadId);
  c("leadId vuoto o di soli spazi → sintetico, mai vuoto", ["bulk:lotto-0123abcd:0003-0004-0005", "bulk:lotto-0123abcd:0003-0004-0005"],
    [F.fatturaDaRiga(ingresso({ leadId: "" })).leadId, F.fatturaDaRiga(ingresso({ leadId: "   " })).leadId]);
  const mille = Array.from({ length: 1000 }, (_, k) => F.fatturaDaRiga(ingresso({ idRiga: `${String(k * 3).padStart(4, "0")}-${String(k * 3 + 1).padStart(4, "0")}-${String(k * 3 + 2).padStart(4, "0")}` })).leadId);
  c("1000 righe: nessun leadId vuoto, tutti diversi", [0, 1000], [mille.filter((x) => !x).length, new Set(mille).size]);
  c("origineBulk: lotto, riga, impronte (copia), nessun percorso né testo letto",
    { lotto: "lotto-0123abcd", riga: "0003-0004-0005", impronte: ["h1", "h2", "h3"] }, f.origineBulk);
  c("con un riferimento, anche quello", "CRO123456", F.fatturaDaRiga(ingresso({ campi: campi({ riferimento: "CRO123456" }) })).origineBulk.riferimento);
  const imp = ["h1"];
  const fi = F.fatturaDaRiga(ingresso({ impronte: imp }));
  imp.push("h2");
  c("le impronte sono una copia: cambiare l'originale non cambia la fattura", ["h1"], fi.origineBulk.impronte);
  c("nella fattura non c'è nessun percorso del bucket", false, /\/bulk\/|\.jpe?g|\.png|dati-fattura/i.test(JSON.stringify(f)));

  gruppo("BULK · T5 · INGRESSI CHE NON SI FATTURANO");
  const rifiuta = (nome, extra) => c(nome, true, lancia(() => F.fatturaDaRiga(ingresso(extra))).length > 0);
  rifiuta("importo mancante", { campi: campi({ importo: null }) });
  rifiuta("importo zero", { campi: campi({ importo: 0 }) });
  rifiuta("importo negativo", { campi: campi({ importo: -5 }) });
  rifiuta("importo con tre decimali (non si arrotonda in silenzio)", { campi: campi({ importo: 10.005 }) });
  rifiuta("importo non numerico", { campi: campi({ importo: Number.NaN }) });
  rifiuta("data mancante", { campi: campi({ data: "" }) });
  rifiuta("data in un altro formato", { campi: campi({ data: "15/03/2026" }) });
  rifiuta("mese 13", { campi: campi({ data: "2026-13-01" }) });
  rifiuta("numero provvisorio zero", { numeroProvvisorio: 0 });
  rifiuta("lotto vuoto", { lotto: "" });
  rifiuta("riga vuota", { idRiga: "" });
  rifiuta("aliquota zero (bollo non gestito: il lotto è bloccato)", { azienda: { ...AZIENDA, aliquotaPredefinita: 0 } });
  rifiuta("aliquota negativa", { azienda: { ...AZIENDA, aliquotaPredefinita: -22 } });
  rifiuta("aliquota non numerica", { azienda: { ...AZIENDA, aliquotaPredefinita: Number.NaN } });
  c("importo con 2 decimali e rumore binario (19.99, 0.1+0.2 centesimi) passa", [19.99, 0.3],
    [F.fatturaDaRiga(ingresso({ campi: campi({ importo: 19.99 }) })).totale, F.fatturaDaRiga(ingresso({ campi: campi({ importo: 0.1 + 0.2 }) })).totale]);
  const cg = congela(ingresso());
  c("input congelato: nessuna mutazione", "", lancia(() => F.fatturaDaRiga(cg)));

  gruppo("BULK · T5 · CON I DATI MANCANTI LA FATTURA SI SIMULA LO STESSO (SERVE A problemiXml)");
  const sim = F.fatturaDaRiga(ingresso({ campi: campi({ cap: "", codiceFiscale: "" }) }));
  const es = X.problemiXml(sim, AZIENDA);
  c("CAP e CF mancanti non fermano la simulazione: li trova problemiXml", [true, true],
    [es.bloccanti.some((b) => b.includes("CAP del cliente")), es.bloccanti.some((b) => b.includes("codice fiscale"))]);
  c("una riga completa (100,00: il file torna uguale): problemiXml non trova niente", { bloccanti: [], avvisi: [] }, X.problemiXml(f100, AZIENDA));
  c("sul 104,00 problemiXml non ha bloccanti (l'eventuale avviso sul totale è quello di R10, scritto da lui)", [], X.problemiXml(f104, AZIENDA).bloccanti);

  gruppo("BULK · T5 · IL GIORNO UTILE (12 GIORNI DI CALENDARIO, STIMA)");
  c("a metà mese", "2026-11-15", F.ultimoGiornoUtile("2026-11-03"));
  c("a cavallo di mese", "2026-12-07", F.ultimoGiornoUtile("2026-11-25"));
  c("a cavallo d'anno", "2027-01-06", F.ultimoGiornoUtile("2026-12-25"));
  c("febbraio bisestile", "2028-03-03", F.ultimoGiornoUtile("2028-02-20"));
  c("febbraio normale", "2027-03-04", F.ultimoGiornoUtile("2027-02-20"));
  c("data non valida → vuoto (è solo una scritta in anteprima)", ["", "", ""], [F.ultimoGiornoUtile(""), F.ultimoGiornoUtile("2027-02-30"), F.ultimoGiornoUtile("ieri")]);

  gruppo("BULK · T5 · IL LOTTO · I DATI DEL CENTRO (R1-R4)");
  c("configurazione a posto (RF01, 22%) → nessun motivo", [], L.controllaLotto(AZIENDA));
  const sg = (az) => sigle(L.controllaLotto(az));
  c("aliquota 0 → lotto bloccato (bollo)", true, sg({ ...AZIENDA, aliquotaPredefinita: 0 }).includes("aliquota_zero_bollo:blocca"));
  c("RF19 con 22% → bloccato per incoerenza", true, sg({ ...AZIENDA, regimeFiscale: "RF19" }).includes("regime_aliquota:blocca"));
  c("RF02 con 22% → bloccato per incoerenza", true, sg({ ...AZIENDA, regimeFiscale: "RF02" }).includes("regime_aliquota:blocca"));
  c("RF01 con 0% → incoerente e senza bollo: due motivi", ["regime_aliquota:blocca", "aliquota_zero_bollo:blocca"], sg({ ...AZIENDA, aliquotaPredefinita: 0 }));
  c("RF19 con 0% → coerente, ma senza bollo resta bloccato", ["aliquota_zero_bollo:blocca"], sg({ ...AZIENDA, regimeFiscale: "RF19", aliquotaPredefinita: 0 }));
  c("aliquota negativa o non numerica → bloccato", [true, true],
    [sg({ ...AZIENDA, aliquotaPredefinita: -1 }).includes("aliquota_zero_bollo:blocca"), sg({ ...AZIENDA, aliquotaPredefinita: Number.NaN }).includes("aliquota_zero_bollo:blocca")]);
  c("aliquote 10 e 4 con RF01 → nessun motivo", [[], []], [L.controllaLotto({ ...AZIENDA, aliquotaPredefinita: 10 }), L.controllaLotto({ ...AZIENDA, aliquotaPredefinita: 4 })]);
  const vuota = L.controllaLotto({ ...AZIENDA, denominazione: "", codiceFiscale: "" });
  c("azienda incompleta → bloccato, e dice cosa manca", [["azienda_incompleta:blocca"], true, true],
    [sigle(vuota), vuota[0]?.testo.includes("ragione sociale"), vuota[0]?.testo.includes("codice fiscale")]);
  const pivaSbagliata = L.controllaLotto({ ...AZIENDA, partitaIva: "12345678901" });
  c("P.IVA con la cifra di controllo sbagliata → bloccato (bloccanti «CHI EMETTE» di problemiXml)", [["azienda_xml:blocca"], true],
    [sigle(pivaSbagliata), pivaSbagliata[0]?.testo.includes("partita IVA del centro")]);
  c("CAP del centro di 4 cifre → bloccato", true, sg({ ...AZIENDA, cap: "2010" }).includes("azienda_xml:blocca"));
  c("REA a metà → bloccato", true, sg({ ...AZIENDA, reaUfficio: "MI" }).length > 0);
  c("ogni motivo è un blocco, con una frase intera", [true, true],
    ((m) => [m.every((x) => x.gravita === "blocca"), m.every((x) => x.testo.length > 20)])(L.controllaLotto({ ...AZIENDA, aliquotaPredefinita: 0, regimeFiscale: "RF19", partitaIva: "1" })));
  const a2 = congela({ ...AZIENDA });
  c("input congelato: nessuna mutazione", "", lancia(() => L.controllaLotto(a2)));
  c("l'azienda a posto non genera avvisi di costo: lo stesso risultato due volte", L.controllaLotto(AZIENDA), L.controllaLotto(AZIENDA));

  gruppo("BULK · T5 · LA FIRMA DELLE IMPOSTAZIONI (R1)");
  const firma = L.firmaImpostazioni(AZIENDA);
  c("è una stringa breve, stabile", [true, firma], [/^[0-9a-f]{8,24}$/.test(firma), L.firmaImpostazioni({ ...AZIENDA })]);
  for (const [nome, cambio] of [
    ["aliquota", { aliquotaPredefinita: 10 }], ["regime", { regimeFiscale: "RF19" }], ["serie", { serie: "A" }],
    ["primo numero", { primoNumero: 40 }], ["anno di numerazione", { annoNumerazione: 2025 }],
  ])
    c(`cambia ${nome} → la firma cambia`, true, L.firmaImpostazioni({ ...AZIENDA, ...cambio }) !== firma);
  c("cambiare la sede o l'IBAN non conta (non cambia i conti né i numeri)", firma, L.firmaImpostazioni({ ...AZIENDA, indirizzo: "Via Nuova", iban: "" }));
  c("22 e «22» e serie con spazi sono la stessa impostazione", firma, L.firmaImpostazioni({ ...AZIENDA, aliquotaPredefinita: "22", serie: " " }));
  c("dentro non c'è nessun dato leggibile", false, [AZIENDA.denominazione, AZIENDA.partitaIva, AZIENDA.iban, AZIENDA.pec].some((d) => firma.includes(d)));

  gruppo("BULK · T5 · IL RIEPILOGO PER IL COMMERCIALISTA");
  const emessa = (extra, ing = {}) => ({
    ...F.fatturaDaRiga(ingresso(ing)), stato: "emessa", numero: 7, anno: 2026, id: "2026-0007", emessaIl: "2026-11-12T10:00:00.000Z", ...extra,
  });
  const fa = emessa({}, { campi: campi({ importo: 1000, data: "2026-10-31", modo: "pos", riferimento: "OP123456" }) });
  const fb = emessa({ numero: 8, id: "2026-0008" }, { campi: campi({ importo: 104, data: "2026-11-01", modo: "bonifico", nome: "Marco", cognome: "Bianchi" }) });
  const fc = emessa({ numero: 3, id: "2025-0003", anno: 2025 }, { campi: campi({ importo: 50, data: "2025-12-31", modo: "contanti" }) });
  const bz = { ...fa, stato: "bozza", numero: 0, id: "bozza:x" };
  const righe = L.righeRiepilogoCommercialista([fb, bz, fa, fc]);
  c("solo le emesse, in ordine di numerazione", ["2025/0003", "2026/0007", "2026/0008"], righe.map((r) => r.numero));
  c("riga completa", {
    numero: "2026/0007", data: "2026-10-31", cliente: "Lucia Verdi", codiceFiscale: CF_PROVA, imponibile: 819.67, iva: 180.33, totale: 1000, totaleNelFile: null,
    modo: "POS (SumUp)", riferimento: "OP123456", meseCompetenza: "2026-10", ultimoGiornoUtile: "2026-11-12",
  }, righe[1]);
  c("mese di competenza = mese del pagamento (31 dicembre → dicembre)", ["2025-12", "2026-01-12"], [righe[0].meseCompetenza, righe[0].ultimoGiornoUtile]);
  // Il commercialista importa l'XML: per riconciliare riga per riga serve il totale che il FILE dice (R10, 104,00 → 104,01).
  const conFile = L.righeRiepilogoCommercialista([fb, fa], AZIENDA);
  c("con il centro: la colonna «totale nel file» (104,00 pagato → 104,01 nel file)", [104, 104.01, 1000, 1000], [conFile[1].totale, conFile[1].totaleNelFile, conFile[0].totale, conFile[0].totaleNelFile]);
  c("… ed è proprio il totale scritto dall'XML", totaleDalTesto(X.costruisciXml(fb, AZIENDA)), conFile[1].totaleNelFile);
  c("senza il centro la colonna è vuota (null), non zero", [null, null], [righe[0].totaleNelFile, righe[2].totaleNelFile]);
  c("modo scritto in chiaro", ["Contanti", "Bonifico"], [righe[0].modo, righe[2].modo]);
  c("con serie: «2026/A/0007»", "2026/A/0007", L.righeRiepilogoCommercialista([{ ...fa, serie: "A" }])[0].numero);
  c("un'azienda cliente → la denominazione", "Rossi Srl", L.righeRiepilogoCommercialista([{ ...fa, cliente: { ...fa.cliente, azienda: true, denominazione: "Rossi Srl" } }])[0].cliente);
  c("nessuna fattura → nessuna riga", [], L.righeRiepilogoCommercialista([]));
  const cgi = congela([fb, fa]);
  c("input congelato: nessuna mutazione, nemmeno nell'ordinamento", "", lancia(() => L.righeRiepilogoCommercialista(cgi)));
  c("le note per il commercialista: scontrini già emessi e fine del termine allo SdI", [true, true],
    [L.NOTE_RIEPILOGO_COMMERCIALISTA.some((n) => /scontrin/i.test(n)), L.NOTE_RIEPILOGO_COMMERCIALISTA.some((n) => /SdI/.test(n))]);

  c("le note citano STS/ATECO («confermato non tenuta») e le fatture tardive (la data resta quella del pagamento)", [true, true, true],
    [L.NOTE_RIEPILOGO_COMMERCIALISTA.some((n) => /Sistema TS|STS/.test(n) && /ATECO/.test(n) && /non tenut/i.test(n)),
      L.NOTE_RIEPILOGO_COMMERCIALISTA.some((n) => /tardiv/i.test(n) && /data/i.test(n) && /pagamento/i.test(n)),
      L.NOTE_RIEPILOGO_COMMERCIALISTA.every((n) => typeof n === "string" && n.trim().length > 20)]);

  gruppo("BULK · T5 · L'XML DI UN CAMPIONE VALIDA CONTRO LO SCHEMA UFFICIALE");
  const schema = join(radice, "prove", "fatturapa-v1.2.2.xsd");
  const cartella = mkdtempSync(join(tmpdir(), "fiscale-bulk-"));
  let seme = 20261112;
  const casuale = () => (seme = (seme * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const campioneImporti = [104, 107, 0.01, 0.03, 999.99, 1234.56, ...Array.from({ length: 18 }, () => Math.round((casuale() * 3000 + 0.01) * 100) / 100)];
  const esiti = [];
  let manca = false;
  let senzaRete = false;
  for (const modo of ["pos", "bonifico", "contanti"]) {
    const brutti = [];
    campioneImporti.forEach((importo, k) => {
      const fs = F.fatturaDaRiga(ingresso({ campi: campi({ importo, modo, riferimento: k % 2 ? "OP123456" : "" }), numeroProvvisorio: k + 1 }));
      const xml = X.costruisciXml(fs, AZIENDA);
      const ok = X.problemiXml(fs, AZIENDA).bloccanti.length === 0 && (modo === "bonifico") === xml.includes("<IBAN>");
      const file = join(cartella, `${modo}-${k}.xml`);
      writeFileSync(file, xml, "utf8");
      if (!ok) brutti.push(`${k}: bloccanti o IBAN`);
      try {
        execFileSync("xmllint", ["--noout", "--schema", schema, file], { stdio: ["ignore", "ignore", "pipe"] });
      } catch (e) {
        const msg = String(e.stderr ?? e.message);
        if (e?.code === "ENOENT") manca = true;
        // Lo schema ufficiale importa quello della firma da w3.org, che ogni tanto rifiuta la richiesta: senza
        // rete non si può dire né sì né no, e si dichiara (le altre prove dello schema in prove.mjs falliscono uguale).
        else if (/failed to load external entity|Failed to locate a schema|failed to compile/.test(msg)) senzaRete = true;
        else brutti.push(`${k}: ${msg.split("\n")[0].slice(0, 120)}`);
      }
    });
    esiti.push([modo, brutti]);
  }
  if (manca) console.log("       (xmllint non installato: validazione contro lo schema saltata)");
  if (senzaRete) console.log("       (schema della firma da w3.org non raggiungibile: validazione contro lo schema saltata)");
  c(`${campioneImporti.length} importi × pos, bonifico, contanti: tutti validi, senza bloccanti, IBAN solo nel bonifico`, [["pos", []], ["bonifico", []], ["contanti", []]], esiti);
}
