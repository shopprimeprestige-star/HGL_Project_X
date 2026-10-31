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
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { provePonteBanner } from "./ponte/banner.mjs";
import { provePonteImmaginiChatUi } from "./ponte/immagini-chat-ui.mjs";
import { provePonteImmaginiMigrazione } from "./ponte/immagini-migrazione.mjs";
import { provePonteImmaginiRegole } from "./ponte/immagini-regole.mjs";
import { provePonteImmaginiRotta } from "./ponte/immagini-rotta.mjs";
import { provePonteIngresso } from "./ponte/ingresso.mjs";
import { provePonteMessaggiPersi } from "./ponte/messaggi-persi.mjs";
import { provePonteInvioChatHook } from "./ponte/invio-chat-hook.mjs";
import { provePonteInvioChatUi } from "./ponte/invio-chat-ui.mjs";
import { provePonteInvioMigrazione } from "./ponte/invio-migrazione.mjs";
import { provePonteInvioRegole } from "./ponte/invio-regole.mjs";
import { provePonteInvioRotta } from "./ponte/invio-rotta.mjs";
import { provePonteInvioScheletro } from "./ponte/invio-scheletro.mjs";
import { provePonteInvioServizio } from "./ponte/invio-servizio.mjs";
import { provePonteMigrazione } from "./ponte/migrazione.mjs";
import { provePonteNonInterferenza } from "./ponte/non-interferenza.mjs";
import { provePontePari } from "./ponte/pari.mjs";
import { provePonteLidEPari } from "./ponte/lid-e-pari.mjs";
import { provePonteRotta } from "./ponte/rotta.mjs";
import { provePonteRevocheIngresso } from "./ponte/revoche-ingresso.mjs";
import { provePonteRevocheServizio } from "./ponte/revoche-servizio.mjs";
import { proveDocumentiExport } from "./ponte/documenti-export.mjs";
import { provePonteServizioCache } from "./ponte/servizio-cache.mjs";
import { provePonteServizioEstrai } from "./ponte/servizio-estrai.mjs";
import { provePonteServizioCollegaImmagini } from "./ponte/servizio-collega-immagini.mjs";
import { provePonteServizioGuardie } from "./ponte/servizio-guardie.mjs";
import { provePonteServizioImmagini } from "./ponte/servizio-immagini.mjs";
import { provePonteServizioLotti } from "./ponte/servizio-lotti.mjs";
import { provePonteStatoChat } from "./ponte/stato-chat.mjs";
import { provePonteTutteMigrazione } from "./ponte/tutte-migrazione.mjs";
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
  c("i limiti del §b", { corpoByte: 262144, messaggi: 200, messaggiStorico: 50, testo: 4000, nome: 80, id: 128, nomi: 200, numeri: 200, chiaviContatori: 22, tsOltreMinuti: 10, tokenMinimo: 32 }, T.LIMITI);
  c(
    "finestre e soglie del §c",
    [180, 120, 1000, 60, 7, 1230768000, 1200, "baileys", 1],
    [T.FINESTRA_PARI_S, T.FINESTRA_OPACA_S, T.CONFRONTO_CARATTERI, T.RICONCILIA_MINUTI, T.EFFETTO_MAX_GIORNI, T.TS_MINIMO, T.BODY_CANDIDATI, T.CANALE_PONTE, T.VERSIONE_CORPO],
  );
  //  30/10 «tutte le chat» (D9 cambiata): un'entrata viva solo del ponte diventa vera dopo 120 secondi.
  c("attesa del pari prima di promuovere un'entrata del ponte (E2): 120 secondi", 120, T.PROMOZIONE_ATTESA_S);
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
    RichiestaNoti: ["v", "tipo", "numeri"],
    RispostaNoti: ["ok", "noti"],
    RigaScrittura: ["k", "n", "d", "t", "x", "e", "m", "s"],
    Pari: ["k", "crm"],
    Scrittura: ["righe", "pari", "nomi"],
    EsitoScrittura: ["nuovi", "gia_presenti", "doppioni", "pari_persi", "contatti_nuovi", "risposto"],
    RichiestaCandidato: ["k", "n", "d", "t"],
    CandidatoCrm: ["k", "id", "created_at", "direction", "body", "canale"],
    //  30/10 «tutte le chat»: `noti` non c'è più (D7 tolta), c'è `promuovi` (D9 cambiata).
    EsitoPromozione: ["promosse", "saltate"],
    PortePonte: ["utente", "candidati", "scrivi", "promuovi", "recentiDelPonte", "battito", "avviso"],
  };
  for (const [nome, attesi] of Object.entries(forme)) c(`forma congelata: ${nome}`, attesi, campi(src, nome));
  c("p_righe non porta duplicato_di (il pari arriva solo da p_pari)", false, campi(src, "RigaScrittura")?.includes("duplicato_di"));

  //  I moduli di T3 entrano nel pacchetto quando esistono: allora devono
  //  esporre i nomi del piano.
  const funzioni = {
    "ponte/pari": ["normalizzaTesto", "eOpaco", "abbinaPari"],
    "ponte/ingresso": ["leggiLotto", "leggiBattito", "leggiNoti", "gestisciRichiesta"],
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
  //  Ogni file di prova di prove/ponte/ deve essere importato e chiamato qui: una prova dimenticata passerebbe in silenzio.
  const sorgente = readFileSync(join(radice, "prove/ponte.mjs"), "utf8");
  const sulDisco = readdirSync(join(radice, "prove/ponte")).filter((f) => f.endsWith(".mjs")).sort();
  const importati = [...sorgente.matchAll(/^import \{ (\w+) \} from "\.\/ponte\/([\w-]+\.mjs)";$/gm)].map((m) => ({ funzione: m[1], file: m[2] }));
  c("ogni file di prove/ponte/*.mjs è importato in ponte.mjs", [], sulDisco.filter((f) => !importati.some((i) => i.file === f)));
  c("…e ogni import punta a un file che esiste", [], importati.filter((i) => !sulDisco.includes(i.file)).map((i) => i.file));
  const chiamate = sorgente.slice(sorgente.indexOf("export async function proveDelPonte"));
  c("…e ogni funzione importata è chiamata da proveDelPonte", [], importati.filter((i) => !new RegExp(`\\b${i.funzione}\\(mod, aiuti\\)`).test(chiamate)).map((i) => i.funzione));
  c("prove.mjs impacchetta ponte/media-tipi e ponte/media quando i file esistono", [true, true], [pr.includes('"ponte/media-tipi"'), pr.includes('"ponte/media"')].map((x, i) => x && existsSync(join(radice, `src/crm/ponte/${["media-tipi", "media"][i]}.ts`))));
  c("il filtro delle «ultime» migrazioni esclude ponte_whatsapp", true, /const ultime = readdirSync\(cartella\)\.filter\([^\n]*!n\.includes\("ponte_whatsapp"\)/.test(pr));
}

export async function proveDelPonte(mod, aiuti) {
  proveDelloScheletro(mod, aiuti);
  await provePonteMigrazione(mod, aiuti);
  await provePonteVecchieMigrazioni(mod, aiuti);
  await provePontePari(mod, aiuti);
  await provePonteLidEPari(mod, aiuti);
  await provePonteIngresso(mod, aiuti);
  await provePonteRotta(mod, aiuti);
  await provePonteNonInterferenza(mod, aiuti);
  await provePonteServizioEstrai(mod, aiuti);
  await provePonteMessaggiPersi(mod, aiuti);
  await provePonteServizioLotti(mod, aiuti);
  await provePonteServizioCache(mod, aiuti);
  await provePonteServizioGuardie(mod, aiuti);
  await provePonteStatoChat(mod, aiuti);
  proveDocumentiExport(mod, aiuti);
  await provePonteTutteMigrazione(mod, aiuti);
  await provePonteBanner(mod, aiuti);
  //  Invio a mano dopo le 24 ore (commessa 2026-10-30-ponte-invio-manuale): sette file, uno per area.
  await provePonteInvioScheletro(mod, aiuti);
  await provePonteInvioRegole(mod, aiuti);
  await provePonteInvioMigrazione(mod, aiuti);
  await provePonteInvioRotta(mod, aiuti);
  await provePonteInvioServizio(mod, aiuti);
  await provePonteInvioChatUi(mod, aiuti);
  await provePonteInvioChatHook(mod, aiuti);
  //  Le immagini del ponte (commessa 2026-10-30-ponte-storico-completo, T4-T8): una prova per area.
  await provePonteImmaginiMigrazione(mod, aiuti);
  await provePonteImmaginiRegole(mod, aiuti);
  await provePonteImmaginiRotta(mod, aiuti);
  await provePonteServizioImmagini(mod, aiuti);
  await provePonteServizioCollegaImmagini(mod, aiuti);
  await provePonteImmaginiChatUi(mod, aiuti);
  //  Le revoche (commessa 2026-10-31, ponte-revoche): un nostro messaggio eliminato per tutti sparisce dal CRM.
  await provePonteRevocheServizio(mod, aiuti);
  await provePonteRevocheIngresso(mod, aiuti);
}
