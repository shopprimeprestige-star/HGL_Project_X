/** ── PROVE: CHAT WHATSAPP · I COSTI DEI MODELLI E IL PANNELLO (29/10/2026) ───────
 *
 *  Commessa 2026-10-29-chat-modelli-costi. Parte A: tariffe e categorie (un solo file
 *  di costanti) e la casella a finestra chiusa che non apre da sola l'elenco.
 *  Parte B: il calcolo dei costi per periodo (ora di Roma).
 *  Dati inventati: nessun numero, nessun nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveChatCosti(mod, { c, gruppo, radice }) {
  const K = mod["chatwa/costi-whatsapp"];
  const T = mod["wa-meta-templates"];

  gruppo("CHAT · COSTI · TARIFFE E CATEGORIE (un solo file)");
  c(
    "tariffe Meta Italia in EUR dalla rate card del 1 ottobre 2026",
    [0.0658, 0.0248],
    [K.TARIFFE.marketing, K.TARIFFE.utility],
  );
  c("data e fonte dichiarate", [true, true], [
    /^2026-10-01$/.test(K.TARIFFE_DAL),
    K.TARIFFE_FONTE.startsWith("https://developers.facebook.com/docs/whatsapp/pricing"),
  ]);
  const utility = [
    "consulenza_conferma_presenza", "cliente_assente", "meet_adesso", "meet_domani", "meet_oggi",
    "non_risponde", "promemoria_meet", "promemoria_sede", "richiamo_concordato", "sede_disdetta",
  ];
  const marketing = [
    "casi_reali", "da_riprogrammare", "meet_da_fissare", "primo_contatto", "richiamo_24h",
    "ricontatto_consulenza", "ritorno", "ultimo_tentativo",
  ];
  c("le dieci Utility di ManyChat", [], utility.filter((n) => K.categoriaModello(`hgl_${n}`) !== "utility" && K.categoriaModello(n) !== "utility"));
  c("le otto Marketing di ManyChat", [], marketing.filter((n) => K.categoriaModello(`hgl_${n}`) !== "marketing"));
  c(
    "la categoria vera vince su quella scritta nel codice (meet_da_fissare, da_riprogrammare)",
    ["UTILITY", "UTILITY", "marketing", "marketing"],
    [
      T.findMetaTemplate("hgl_meet_da_fissare").category,
      T.findMetaTemplate("hgl_da_riprogrammare").category,
      K.categoriaModello("hgl_meet_da_fissare", "UTILITY"),
      K.categoriaModello("hgl_da_riprogrammare", "UTILITY"),
    ],
  );
  c("i nomi _v2 / _v3 valgono come l'originale", ["marketing", "utility", "marketing"], [
    K.categoriaModello("hgl_primo_contatto_v2"),
    K.categoriaModello("hgl_meet_oggi_v3"),
    K.categoriaModello("primo_contatto_v2"),
  ]);
  c("un modello sconosciuto usa la categoria dichiarata", ["utility", "marketing"], [
    K.categoriaModello("altro_nuovo", "UTILITY"),
    K.categoriaModello("altro_nuovo", "MARKETING"),
  ]);
  c("…e senza categoria vale la più cara (mai sottostimare)", "marketing", K.categoriaModello("altro_nuovo"));
  c("prezzo di un modello", [0.0658, 0.0248], [K.prezzoModello("hgl_ritorno"), K.prezzoModello("hgl_meet_oggi")]);
  c("euro: virgola all'italiana", ["0,0658 €", "1,23 €", "0,00 €"], [K.euro(0.0658, 4), K.euro(1.2345, 2), K.euro(0, 2)]);
  c(
    "la nota dei prezzi dice cifre, data e che si paga",
    true,
    /Marketing ≈ 0,0658 €/.test(K.notaPrezzi()) &&
      /Utility ≈ 0,0248 €/.test(K.notaPrezzi()) &&
      /1 ottobre 2026/.test(K.notaPrezzi()) &&
      /si paga/i.test(K.notaPrezzi()),
  );

  gruppo("CHAT · FINESTRA CHIUSA · L'ELENCO NON SI APRE DA SOLO");
  const cas = readFileSync(join(radice, "src/crm/chatwa/Casella.tsx"), "utf8");
  const sm = readFileSync(join(radice, "src/crm/chatwa/ScegliModello.tsx"), "utf8");
  const blocco = cas.slice(cas.indexOf('if (stato === "solo_modelli")'), cas.indexOf("const configurata"));
  c("un pulsante «Invia un modello» c'è", true, /Invia un modello/.test(blocco));
  c("lo stato dell'elenco parte chiuso", true, /useState\(false\)/.test(cas) && /modelliAperti/.test(cas));
  c("l'elenco è dentro un foglio che si apre solo a richiesta", true, /<Sheet open=\{modelliAperti\}/.test(blocco));
  c("fuori dal foglio non c'è nessun elenco", 1, (blocco.match(/<ScegliModello/g) ?? []).length);
  c("…e sta dopo l'apertura del foglio", true, blocco.indexOf("<Sheet open") < blocco.indexOf("<ScegliModello"));
  c("la barra dice «Finestra chiusa · solo modelli approvati»", true, /Finestra chiusa · solo modelli approvati/.test(blocco));
  c("ogni modello dell'elenco mostra categoria e prezzo, e la nota si paga", true, /categoriaModello\(/.test(sm) && /prezzoModello\(/.test(sm) && /notaPrezzi\(\)/.test(sm));
  c("niente di nuovo con la finestra aperta (la frase resta)", true, /Puoi scrivere libero/.test(readFileSync(join(radice, "src/crm/chatwa/stato.ts"), "utf8")) && !/costi-whatsapp/.test(cas.slice(cas.indexOf("const configurata"))));
}
