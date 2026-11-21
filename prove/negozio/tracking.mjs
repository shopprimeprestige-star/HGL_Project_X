/** ── NEGOZIO · R2 · T47 · IL TRACKING DELLA SPEDIZIONE (PURO) ─────────────────────────────────────────────
 *  `src/crm/ecommerce/tracking.ts` (D55; SPEC 8A n. 2): l'elenco di partenza dei corrieri (UNO solo, lo stesso del seme di S5), il numero
 *  valido e il link, che si costruisce SOLO se il corriere ha un modello `https://` con `{numero}` (la regola è di `corriereLink`, T45).
 *  Dati inventati: modelli su `tracking.example`, numeri finti. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function prove(mod, { c, gruppo, radice }) {
  const T = mod["ecommerce/tracking"];
  const src = readFileSync(join(radice, "src/crm/ecommerce/tracking.ts"), "utf8");
  const senzaCommenti = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  gruppo("NEGOZIO R2 · IL TRACKING DELLA SPEDIZIONE (T47)");

  // ── i corrieri di partenza: un solo elenco, quello del seme di S5 ──
  const sql = readFileSync(join(radice, "supabase/migrations/20261122130000_shop_spedizioni.sql"), "utf8");
  const seme = JSON.parse(/\('corrieri', '(\[.*?\])'::jsonb\)/.exec(sql)?.[1] ?? "[]");
  c("i sei nomi del seme di S5 (letti dalla migrazione, non copiati)", 6, seme.length);
  c("CORRIERI_DI_PARTENZA = i nomi del seme di S5, nello stesso ordine", seme.map((v) => v.nome), [...T.CORRIERI_DI_PARTENZA]);
  c("sono solo nomi (stringhe), senza modelli di link: il modello lo scrive il titolare", true, T.CORRIERI_DI_PARTENZA.every((n) => typeof n === "string" && n.trim() === n && n.length > 0));
  c("nessun nome ripetuto", T.CORRIERI_DI_PARTENZA.length, new Set(T.CORRIERI_DI_PARTENZA.map((n) => n.toLowerCase())).size);

  // ── il numero ──
  const buoni = ["123456789012", "1Z999AA10123456784", "RR123456789IT", "GLS 12345678", "ab-1234/5.6"];
  c("numeroValido: numeri veri di corrieri → sì", [], buoni.filter((n) => !T.numeroValido(n)));
  c("numeroValido: vuoto, solo spazi, troppo corto, troppo lungo → no", [false, false, false, false], ["", "     ", "12", "1".repeat(41)].map((n) => T.numeroValido(n)));
  c("numeroValido: non testo → no, senza lanciare", [false, false, false, false, false], [undefined, null, 123456789, {}, ["123456"]].map((n) => T.numeroValido(n)));
  c("numeroValido: caratteri di controllo, tag, graffe, @, virgolette → no", [], ["123\n456", "12345\u0000", "<b>12345</b>", "{numero}", "a@b.example", "12345\"6", "123456%00"].filter((n) => T.numeroValido(n)));
  c("numeroValido: gli spazi ai bordi non contano", true, T.numeroValido("  123456789  "));

  // ── il link: solo con un modello valido ──
  const corrieri = [
    { nome: "BRT", modello: "https://tracking.example/brt?codice={numero}" },
    { nome: "GLS", modello: "" },
    { nome: "SDA", modello: "http://tracking.example/sda?n={numero}" },
    { nome: "DHL", modello: "https://tracking.example/dhl" },
    { nome: "UPS", modello: "https://{numero}.tracking.example/ups" },
    { nome: "Poste Italiane", modello: "https://tracking.example/poste/{numero}/dettaglio" },
  ];
  c("costruisciLink: corriere con modello valido → l'indirizzo col numero", "https://tracking.example/brt?codice=123456789012", T.costruisciLink(corrieri, "BRT", "123456789012"));
  c("costruisciLink: il nome si legge senza badare a maiuscole e spazi ai bordi del numero", "https://tracking.example/brt?codice=123456789012", T.costruisciLink(corrieri, "brt", " 123456789012 "));
  c("costruisciLink: il numero si codifica (spazio, barra)", "https://tracking.example/poste/RR%2F12%2034/dettaglio", T.costruisciLink(corrieri, "Poste Italiane", "RR/12 34"));
  c("costruisciLink: modello vuoto, http, senza {numero}, con {numero} nell'host → null", [null, null, null, null], ["GLS", "SDA", "DHL", "UPS"].map((n) => T.costruisciLink(corrieri, n, "123456789012")));
  c("costruisciLink: corriere che non c'è → null", null, T.costruisciLink(corrieri, "Piccione Viaggiatore", "123456789012"));
  c("costruisciLink: numero non valido → null (anche con un modello valido)", [null, null, null], ["", "12", "<script>"].map((n) => T.costruisciLink(corrieri, "BRT", n)));
  c("costruisciLink: elenco che non è un elenco, o senza modelli → null, senza lanciare", [null, null, null, null], [undefined, null, "BRT", [{ nome: "BRT" }]].map((l) => T.costruisciLink(l, "BRT", "123456789012")));
  c("costruisciLink: l'elenco di partenza (solo nomi) non dà mai un link", [], [...T.CORRIERI_DI_PARTENZA].filter((n) => T.costruisciLink([...T.CORRIERI_DI_PARTENZA].map((nome) => ({ nome })), n, "123456789012") !== null));

  // ── il sorgente: la regola del link è UNA, di T45 ──
  c("tracking.ts usa `corriereLink` di T45 e non riscrive la regola del modello", [true, false], [/corriereLink/.test(senzaCommenti) && /shop\/cassa\/spedizione/.test(senzaCommenti), /\{numero\}|encodeURIComponent|new URL/.test(senzaCommenti)]);
  c("modulo puro: niente React, rete o database", false, /from\s+["'](react|@supabase|@\/integrations)|fetch\(|supabase/i.test(senzaCommenti));
}
