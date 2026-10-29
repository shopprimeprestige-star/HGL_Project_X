/** ── LE PROVE DEL PONTE WHATSAPP (Baileys) ──────────────────────────────────
 *
 *  Commessa 2026-10-29-ponte-whatsapp-baileys. Come `prove/sheets.mjs`:
 *  `prove/prove.mjs` impacchetta i moduli (voci `ponte/…` di MODULI) e chiama
 *  `proveDelPonte(mod, aiuti)`, che chiama in ordine i file d'area di
 *  `prove/ponte/`.
 *
 *  ⚠️ UN FILE PER AREA, UN COMPITO PER FILE. Questo e `prove.mjs` li tocca solo
 *   il compito T0, una volta. Un file d'area ancora vuoto passa.
 *  ⚠️ `aiuti` = { c, gruppo, radice }: `c(nome, atteso, letto)` conta il
 *   controllo, `gruppo(titolo)` apre un blocco, `radice` è la cartella del
 *   progetto.
 *  ⚠️ LO SCHELETRO QUI SOTTO CONGELA I CONTRATTI di `src/crm/ponte/tipi.ts`:
 *   valori, liste chiuse e campi delle forme JSON fra SQL e porte (obiezione 9
 *   del revisore). Se un compito li cambia senza passare dalla LAVAGNA, qui si
 *   vede.
 *  ───────────────────────────────────────────────────────────────────────── */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { provePonteBanner } from "./ponte/banner.mjs";
import { provePonteIngresso } from "./ponte/ingresso.mjs";
import { provePonteMigrazione } from "./ponte/migrazione.mjs";
import { provePonteNonInterferenza } from "./ponte/non-interferenza.mjs";
import { provePontePari } from "./ponte/pari.mjs";
import { provePonteRotta } from "./ponte/rotta.mjs";
import { provePonteServizioEstrai } from "./ponte/servizio-estrai.mjs";
import { provePonteServizioGuardie } from "./ponte/servizio-guardie.mjs";
import { provePonteServizioLotti } from "./ponte/servizio-lotti.mjs";
import { provePonteStatoChat } from "./ponte/stato-chat.mjs";
import { provePonteVecchieMigrazioni } from "./ponte/vecchie-migrazioni.mjs";

/** I campi di un'interfaccia (o i metodi), letti dal sorgente, in ordine. */
function campi(sorgente, nome) {
  const m = sorgente.match(new RegExp(`export interface ${nome} \\{([\\s\\S]*?)\\n\\}`));
  if (!m) return null;
  const corpo = m[1].replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  return [...corpo.matchAll(/^\s{2}(\w+)\??[:(]/gm)].map((x) => x[1]);
}

/** Lo scheletro del compito T0: i contratti congelati e il collegamento. */
function proveDelloScheletro(mod, { c, gruppo, radice }) {
  gruppo("PONTE WHATSAPP · LO SCHELETRO (compito T0)");
  const T = mod["ponte/tipi"];
  c("i limiti del §b", { corpoByte: 262144, messaggi: 200, messaggiStorico: 50, testo: 4000, nome: 80, id: 128, nomi: 200, chiaviContatori: 20, tsOltreMinuti: 10, tokenMinimo: 32 }, T.LIMITI);
  c(
    "finestre e soglie del §c",
    [180, 120, 1000, 60, 7, 1230768000, 1200, "baileys", 1],
    [T.FINESTRA_PARI_S, T.FINESTRA_OPACA_S, T.CONFRONTO_CARATTERI, T.RICONCILIA_MINUTI, T.EFFETTO_MAX_GIORNI, T.TS_MINIMO, T.BODY_CANDIDATI, T.CANALE_PONTE, T.VERSIONE_CORPO],
  );
  c("stati del ponte: lista chiusa del §b3", ["collegato", "in_collegamento", "attesa_qr", "sessione_scaduta", "sostituita", "rete_assente", "coda_piena", "errore", "fermo"], [...T.STATI_PONTE]);
  c("tipi di contenuto del §b2", ["testo", "foto", "vocale", "audio", "video", "documento", "sticker", "posizione", "contatto", "altro"], [...T.TIPI_CONTENUTO]);
  c("stati di invio", ["sent", "delivered", "read", "failed"], [...T.STATI_INVIO]);
  c("errori e stati HTTP del §b1", { non_configurato: 503, non_autorizzato: 401, troppo_grande: 413, corpo_non_valido: 400, database: 500 }, T.ERRORI_HTTP);
  c("codici dei log: solo parole minuscole", true, T.CODICI_AVVISO.length > 0 && T.CODICI_AVVISO.every((x) => /^[a-z_]+$/.test(x)));
  c("la chiave del messaggio (§b5)", "bw:393331234567:3EB0A1", T.chiaveMessaggio("393331234567", "3EB0A1"));
  c("solo cifre (§c1.2)", ["393331234567", "393331234567", ""], [T.cifre("+39 333 123-4567"), T.cifre("393331234567"), T.cifre(null)]);

  //  Le forme JSON fra SQL (T1) e porte (T4), campo per campo e in ordine.
  const src = readFileSync(join(radice, "src/crm/ponte/tipi.ts"), "utf8");
  const forme = {
    MessaggioPonte: ["id", "numero", "dir", "ts", "testo", "tipo", "stato"],
    LottoPonte: ["v", "tipo", "origine", "messaggi", "nomi"],
    BattitoPonte: ["v", "tipo", "stato", "collegato_dal", "ultimo_messaggio_il", "storico", "in_coda", "scartati", "contatori", "versione"],
    BattitoPulito: ["stato", "collegato_dal", "ultimo_messaggio_il", "storico", "contatori", "versione"],
    RispostaLotto: ["ok", "ricevuti", "nuovi", "gia_presenti", "doppioni", "scartati", "fuori_rubrica", "non_noti"],
    RispostaBattito: ["ok", "riconciliati"],
    RigaScrittura: ["k", "n", "d", "t", "x", "e", "m", "s"],
    Pari: ["k", "crm"],
    Scrittura: ["righe", "pari", "nomi"],
    EsitoScrittura: ["nuovi", "gia_presenti", "doppioni", "pari_persi", "contatti_nuovi", "risposto"],
    RichiestaCandidato: ["k", "n", "d", "t"],
    CandidatoCrm: ["k", "id", "created_at", "direction", "body", "canale"],
    PortePonte: ["utente", "noti", "candidati", "scrivi", "recentiDelPonte", "battito", "avviso"],
  };
  for (const [nome, attesi] of Object.entries(forme)) c(`forma congelata: ${nome}`, attesi, campi(src, nome));
  c("p_righe non porta duplicato_di (il pari arriva solo da p_pari)", false, campi(src, "RigaScrittura")?.includes("duplicato_di"));

  //  I moduli di T3 entrano nel pacchetto quando esistono: allora devono
  //  esporre i nomi del piano.
  const funzioni = {
    "ponte/pari": ["normalizzaTesto", "eOpaco", "abbinaPari"],
    "ponte/ingresso": ["leggiLotto", "leggiBattito", "gestisciRichiesta"],
  };
  for (const [nome, attese] of Object.entries(funzioni)) {
    if (!existsSync(join(radice, `src/crm/${nome}.ts`))) continue;
    c(`${nome}: espone ${attese.join(", ")}`, attese.map(() => "function"), attese.map((f) => typeof mod[nome]?.[f]));
  }

  //  Il collegamento in prove.mjs, e il filtro che lascia passare la
  //  migrazione nuova nella prova «vengono dopo l'ultima migrazione esistente».
  const pr = readFileSync(join(radice, "prove/prove.mjs"), "utf8");
  c("prove.mjs impacchetta ponte/tipi, ponte/pari, ponte/ingresso", [true, true, true], ['"ponte/tipi"', '"ponte/pari"', '"ponte/ingresso"'].map((x) => pr.includes(x)));
  c("prove.mjs chiama proveDelPonte", true, /^await proveDelPonte\(mod, \{ c, gruppo, radice \}\);$/m.test(pr));
  c("il filtro delle «ultime» migrazioni esclude ponte_whatsapp", true, /const ultime = readdirSync\(cartella\)\.filter\([^\n]*!n\.includes\("ponte_whatsapp"\)/.test(pr));
}

export async function proveDelPonte(mod, aiuti) {
  proveDelloScheletro(mod, aiuti);
  await provePonteMigrazione(mod, aiuti);
  await provePonteVecchieMigrazioni(mod, aiuti);
  await provePontePari(mod, aiuti);
  await provePonteIngresso(mod, aiuti);
  await provePonteRotta(mod, aiuti);
  await provePonteNonInterferenza(mod, aiuti);
  await provePonteServizioEstrai(mod, aiuti);
  await provePonteServizioLotti(mod, aiuti);
  await provePonteServizioGuardie(mod, aiuti);
  await provePonteStatoChat(mod, aiuti);
  await provePonteBanner(mod, aiuti);
}
