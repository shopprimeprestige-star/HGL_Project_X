/** ── PROVE: MEETLY «PRESENTE MA NON AVVIATO» (10/11/2026) ──────────────────────
 *  Regole in src/shop/scheda-ferma.ts; innesti in src/shop/call.tsx.
 *  La sequenza che bloccava tutto, in due tempi:
 *   · due schede consulente nella stessa stanza (o una ricaricata): quella ferma,
 *     senza media, si annunciava con lo stesso `dev` dell'altra, e ogni suo
 *     saluto (ogni 3 s) faceva buttare al cliente la connessione ancora in
 *     costruzione verso quella in chiamata (ping-pong `dedupe-dev`/`dedupe-host`);
 *   · il cliente non sapeva che il consulente era in chiamata (la `callstate` è
 *     una sola, a perdere) e non apriva mai i media: nessuno offriva, nessuno
 *     rispondeva, e il paracadute dei 15 s — armato solo dentro `openMedia` —
 *     non scattava mai.
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveMeetlyAvvio(mod, { c, gruppo, radice }) {
  const M = mod["shop/scheda-ferma"];

  gruppo("MEETLY · IL SALUTO DICE SE IL CONSULENTE È IN CHIAMATA");
  c("act:true → in chiamata", true, M.inChiamataDichiarata({ act: true }));
  c("act:false → ferma", false, M.inChiamataDichiarata({ act: false }));
  c("senza act (scheda vecchia) → non si sa", undefined, M.inChiamataDichiarata({ pid: "x" }));
  c("payload assente o strano → non si sa", [undefined, undefined, undefined], [
    M.inChiamataDichiarata(null),
    M.inChiamataDichiarata(undefined),
    M.inChiamataDichiarata({ act: "si" }),
  ]);

  gruppo("MEETLY · UNA SCHEDA FERMA NON BUTTA FUORI QUELLA IN CHIAMATA");
  c("il sano non si tocca mai", false, M.puoSostituireVoceHost({ nuovoInChiamata: true, vecchioInChiamata: true, vecchioSano: true }));
  c("ferma contro in chiamata (non ancora sana): NO — era il ping-pong", false, M.puoSostituireVoceHost({ nuovoInChiamata: false, vecchioInChiamata: true, vecchioSano: false }));
  c("ferma contro una vecchia versione (non si sa): NO", false, M.puoSostituireVoceHost({ nuovoInChiamata: false, vecchioInChiamata: undefined, vecchioSano: false }));
  c("in chiamata contro ferma: sì", true, M.puoSostituireVoceHost({ nuovoInChiamata: true, vecchioInChiamata: false, vecchioSano: false }));
  c("ferma contro ferma: sì (come prima: il consulente ricaricato sostituisce il vecchio pid)", true, M.puoSostituireVoceHost({ nuovoInChiamata: false, vecchioInChiamata: false, vecchioSano: false }));
  c("vecchie versioni (non si sa) fra loro: sì, come prima", true, M.puoSostituireVoceHost({ nuovoInChiamata: undefined, vecchioInChiamata: undefined, vecchioSano: false }));
  c("un cliente che sostituisce un cliente (nessun act): sì, come prima", true, M.puoSostituireVoceHost({ nuovoInChiamata: undefined, vecchioInChiamata: undefined, vecchioSano: false }));

  gruppo("MEETLY · AL CONSULENTE FERMO NON SI OFFRE NULLA");
  c("ferma: non si chiama", false, M.haSensoChiamare(false));
  c("in chiamata o non si sa: si chiama", [true, true], [M.haSensoChiamare(true), M.haSensoChiamare(undefined)]);

  gruppo("MEETLY · IL CLIENTE CHE NON SAPEVA APRE I MEDIA DA SOLO");
  c("consulente in chiamata, io non lo so ancora: apro", true, M.devoAvviareMedia({ hostInChiamata: true, miaAttiva: false }));
  c("lo so già: niente (lo fa la callstate)", false, M.devoAvviareMedia({ hostInChiamata: true, miaAttiva: true }));
  c("«solo contenuti» (consulente non in chiamata): la camera NON si apre", false, M.devoAvviareMedia({ hostInChiamata: false, miaAttiva: false }));
  c("scheda vecchia (non si sa): niente", false, M.devoAvviareMedia({ hostInChiamata: undefined, miaAttiva: false }));

  gruppo("MEETLY · IL BATTITO NON CANCELLA «IN CHIAMATA» A UNA SCHEDA CHE STA PER RIPRENDERE");
  c("in chiamata: sempre vero", true, M.inChiamataDaBattere({ attiva: true, tenutoFinoA: 0, adesso: 1000 }));
  c("ricaricata, il server diceva «in chiamata», finestra aperta: vero", true, M.inChiamataDaBattere({ attiva: false, tenutoFinoA: 5000, adesso: 1000 }));
  c("finestra chiusa: falso, come prima", false, M.inChiamataDaBattere({ attiva: false, tenutoFinoA: 5000, adesso: 5000 }));
  c("mai tenuto: falso, come prima", false, M.inChiamataDaBattere({ attiva: false, tenutoFinoA: 0, adesso: 1000 }));
  c("la finestra è di un minuto", 60_000, M.TIENI_IN_CHIAMATA_MS);

  gruppo("MEETLY · GLI INNESTI IN CALL.TSX (LETTI DAL SORGENTE)");
  const src = readFileSync(join(radice, "src/shop/call.tsx"), "utf8");
  const senza = src.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");
  const corpo = (firma) => {
    const i = senza.indexOf(firma);
    if (i < 0) return "";
    const a = senza.indexOf("{", senza.indexOf(")", i + firma.length));
    let n = 0;
    for (let k = a; k < senza.length; k++) {
      if (senza[k] === "{") n++;
      else if (senza[k] === "}" && --n === 0) return senza.slice(a, k + 1);
    }
    return "";
  };
  c("importa le regole", true, /from "@\/shop\/scheda-ferma"/.test(senza));

  const sh = corpo("function sendHello(");
  c("il saluto del consulente dice se è in chiamata (act), solo se è consulente", true, /S\.role === "host" \? \{ act: S\.active \}/.test(sh));

  const hello = senza.slice(senza.indexOf('event: "hello"'), senza.indexOf('event: "bye"'));
  c("hello: il cliente prende nota di chi è in chiamata", true, /hostInChiamata\.set\(pid,/.test(hello));
  c("hello: dedupe-dev e dedupe-host passano dalla regola, non più dal solo «sano»", 2, (hello.match(/puoSostituireVoceHost\(/g) || []).length);
  c("hello: il cliente apre i media se il consulente è in chiamata e lui non lo sapeva", true, /devoAvviareMedia\(/.test(hello) && /viewerEnsureMedia\(\)/.test(hello));

  const mi = corpo("async function maybeInitiate(");
  c("maybeInitiate non chiama il consulente fermo", true, /haSensoChiamare\(hostInChiamata\.get\(pid\)\)/.test(mi));
  c("…dopo il ramo SFU (la prova degli innesti SFU vuole quello per primo) e prima di puoNegoziare", true,
    mi.indexOf("trasportoSfu()") < mi.indexOf("haSensoChiamare") && mi.indexOf("haSensoChiamare") < mi.indexOf("puoNegoziare"));

  c("la mappa si pulisce: removePeer, resetRoster, teardownMedia", [true, true, true], [
    /hostInChiamata\.delete\(pid\)/.test(corpo("function removePeer(")),
    /hostInChiamata\.clear\(\)/.test(corpo("function resetRoster(")),
    /hostInChiamata\.clear\(\)/.test(corpo("function teardownMedia(")),
  ]);

  const om = corpo("async function openMedia(");
  c("openMedia: il paracadute dei 15 s è armato PRIMA di prefetchIce (che può restare appesa)", true,
    om.indexOf("SENZA_MEDIA_DOPO_MS") > 0 && om.indexOf("SENZA_MEDIA_DOPO_MS") < om.indexOf("await prefetchIce()"));
  c("openMedia: il timer si spegne comunque (finally) e prefetchIce è dentro lo stesso try", true,
    /clearTimeout\(attesa\)/.test(om) && om.indexOf("await prefetchIce()") > om.indexOf("try {"));

  const hb = corpo("function pushHeartbeat(");
  c("il battito passa dalla regola", true, /inChiamataDaBattere\(/.test(hb));
  const ri = corpo("async function riprendiConsulenzaAperta(");
  c("la ripresa apre la finestra se il server diceva «in chiamata», PRIMA del primo battito", true,
    /inChiamataTenutoFinoA = Date\.now\(\) \+ TIENI_IN_CHIAMATA_MS/.test(ri) && ri.search(/inChiamataTenutoFinoA = /) < ri.indexOf("pushHeartbeat()"));
}
