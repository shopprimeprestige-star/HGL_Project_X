/** ── PROVE: L'INTERRUTTORE DELLA PRENOTAZIONE IN CHAT (Impostazioni → WhatsApp) ──
 *
 *  Commessa 2026-10-27, richiesta del titolare («posso attivare e disattivare
 *  questa funzione»). `rigaConAcceso` (puro, in `prenota-tipi.ts`) fa la riga
 *  nuova dalla vecchia; la rotta `/api/crm/prenota-chat` e il riquadro sono
 *  sottili e qui si guardano nel sorgente (guardia, nessuna cancellazione).
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function proveDellInterruttorePrenota(mod, { c, gruppo, radice }) {
  const { rigaConAcceso, leggiConfigPrenota } = mod["manychat/prenota-tipi"];
  const PREDEFINITI = { consulenteId: "", preavvisoOre: 3, giorniAvanti: 14, durataMin: 60 };
  const conf = (acceso, resto) => JSON.stringify({ v: 1, acceso, ...resto });

  gruppo("PRENOTA · INTERRUTTORE · LA RIGA NUOVA");
  {
    //  Senza riga: i valori predefiniti
    c("senza riga, accendi: acceso e valori predefiniti",
      { acceso: true, ...PREDEFINITI }, leggiConfigPrenota(rigaConAcceso(null, true)));
    c("senza riga, spegni: la riga c'è ed è spenta",
      { v: 1, acceso: false, ...PREDEFINITI }, JSON.parse(rigaConAcceso(null, false)));
    c("riga vuota o storta: come senza riga",
      [true, true, true],
      ["", "{non json", "42"].map((t) => leggiConfigPrenota(rigaConAcceso(t, true))?.acceso));
    c("una lista al posto dell'oggetto: come senza riga",
      { v: 1, acceso: true, ...PREDEFINITI }, JSON.parse(rigaConAcceso("[1,2]", true)));

    //  Con riga: si tiene il resto
    const mia = { consulenteId: "cons-1", preavvisoOre: 6, giorniAvanti: 7, durataMin: 45 };
    c("da spenta a accesa: tiene consulente, preavviso, giorni, durata",
      { acceso: true, ...mia }, leggiConfigPrenota(rigaConAcceso(conf(false, mia), true)));
    const spenta = JSON.parse(rigaConAcceso(conf(true, mia), false));
    c("da accesa a spenta: acceso false esatto e il resto com'era",
      { v: 1, acceso: false, ...mia }, spenta);
    c("spenta, per la rotta, vale «nessuno» (leggiConfigPrenota dà null)",
      null, leggiConfigPrenota(JSON.stringify(spenta)));
    c("spegni e riaccendi: si torna alla stessa configurazione",
      { acceso: true, ...mia },
      leggiConfigPrenota(rigaConAcceso(rigaConAcceso(conf(true, mia), false), true)));
    c("accendere una riga già accesa non cambia niente",
      { acceso: true, ...mia }, leggiConfigPrenota(rigaConAcceso(conf(true, mia), true)));

    //  Valori fuori scala o strani: tornano al predefinito, come li leggerebbe la rotta
    c("fuori scala o non interi: predefiniti (consulenteId ripulito)",
      { acceso: true, consulenteId: "x", preavvisoOre: 3, giorniAvanti: 14, durataMin: 60 },
      leggiConfigPrenota(rigaConAcceso(
        conf(false, { consulenteId: " x ", preavvisoOre: 99, giorniAvanti: 2.5, durataMin: "60" }), true)));
    c("l'acceso vecchio non conta: \"true\" come testo non accende da solo, ma l'interruttore sì",
      true, leggiConfigPrenota(rigaConAcceso(conf("true", {}), true))?.acceso);
    c("un campo in più della riga (ad es. una nota) non si perde",
      "nota", JSON.parse(rigaConAcceso(conf(true, { nota: "nota" }), false)).nota);
    c("il risultato è sempre un testo JSON con acceso booleano",
      ["boolean", "boolean"],
      [rigaConAcceso(null, true), rigaConAcceso(conf(true, {}), false)].map((t) => typeof JSON.parse(t).acceso));
  }

  gruppo("PRENOTA · INTERRUTTORE · ROTTA E RIQUADRO (sorgente)");
  {
    const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const rotta = senzaCommenti(readFileSync(join(radice, "src/routes/api.crm.prenota-chat.ts"), "utf8"));
    const riquadro = senzaCommenti(readFileSync(join(radice, "src/crm/PrenotaChatPannello.tsx"), "utf8"));
    const albero = readFileSync(join(radice, "src/routeTree.gen.ts"), "utf8");
    const imp = readFileSync(join(radice, "src/routes/CRM.impostazioni.tsx"), "utf8");
    c("la rotta è /api/crm/prenota-chat", true, rotta.includes('createFileRoute("/api/crm/prenota-chat")'));
    c("GET e POST, e solo quelli (più OPTIONS)", ["OPTIONS", "GET", "POST"],
      [...rotta.matchAll(/\b(OPTIONS|GET|POST|PUT|PATCH|DELETE)\s*:/g)].map((x) => x[1]));
    c("GET e POST dietro guardiaCRM(«impostazioni»), e solo quello",
      [2, 2], [(rotta.match(/guardiaCRM\(request, cors, "impostazioni"\)/g) ?? []).length,
        (rotta.match(/guardiaCRM\(/g) ?? []).length]);
    c("scrive con rigaConAcceso e non cancella mai la riga", [true, false],
      [rotta.includes("rigaConAcceso("), /\.delete\(|elimina/i.test(rotta)]);
    c("nessun console.log né numero in chiaro nei log", false, /console\./.test(rotta));
    c("la rotta è nell'albero generato", true, albero.includes("'/api/crm/prenota-chat'"));
    c("il riquadro passa dalla rotta e non scrive app_config dal browser",
      [true, false], [riquadro.includes("/api/crm/prenota-chat"), /app_config|supabase/.test(riquadro)]);
    c("il riquadro usa lo Switch, è chiuso a chi non ha «impostazioni», dice l'errore",
      [true, true, true],
      [riquadro.includes("<Switch"), riquadro.includes('usePuo()("impostazioni")'), riquadro.includes("toast.error")]);
    c("il riquadro è nella scheda WhatsApp, una volta sola", 1,
      (imp.match(/<PrenotaChatPannello \/>/g) ?? []).length);
    const sql = readFileSync(join(radice, "supabase/PRENOTA-CHAT.sql"), "utf8");
    c("lo script dice che ora c'è l'interruttore nel CRM", true, /interruttore/i.test(sql));
  }
}
