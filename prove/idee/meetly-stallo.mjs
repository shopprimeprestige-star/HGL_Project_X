/** ── PROVE: MEETLY «DENTRO MA SPENTI» (31/10/2026) ────────────────────────────
 *  Regola in src/shop/senza-media.ts; innesti in src/shop/call.tsx.
 *  Tre parti:
 *   1. la regola pura;
 *   2. una simulazione con due finti peer (consulente e ospite) che riproduce il
 *      giro di segnalazione di call.tsx — hello ogni 3 s, offre solo il pid
 *      minore, l'offerta si rimanda finché non arriva la risposta, l'offerta in
 *      arrivo si scarta se la scheda non può negoziare — con la regola VECCHIA
 *      (solo `localStream`) e la NUOVA. ⚠️ È un modello del giro, non il browser:
 *      i punti reali sono controllati nella parte 3;
 *   3. gli innesti letti dal sorgente (uno tolto fa fallire la prova).
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveMeetlyStallo(mod, { c, gruppo, radice }) {
  const M = mod["shop/senza-media"];
  const PASSO = 3000; // un hello ogni 3 s (avviaBattito)
  const FINE = 90_000;

  gruppo("MEETLY · SI NEGOZIA SE I MEDIA CI SONO O È CERTO CHE NON CI SARANNO");
  c("con i media: sì", true, M.puoNegoziare({ haMedia: true, mediaFallita: false }));
  c("media in attesa del permesso: no (comportamento di sempre)", false, M.puoNegoziare({ haMedia: false, mediaFallita: false }));
  c("media falliti o appesi: sì, in sola ricezione", true, M.puoNegoziare({ haMedia: false, mediaFallita: true }));
  c("l'attesa prima di collegarsi senza media è quindici secondi", 15_000, M.SENZA_MEDIA_DOPO_MS);

  // ── la simulazione ──────────────────────────────────────────────────────
  //  media: "subito" | "mai" (richiesta fallita a 2 s) | "appeso" (non risponde mai)
  //       | numero (ms a cui il permesso arriva)
  function simula({ regola, pidA, mediaA, pidB, mediaB }) {
    const nuovo = regola === "nuova";
    const mk = (pid, media) => ({ pid, media, haMedia: media === "subito", fallita: false, pc: null, scartate: 0 });
    const A = mk(pidA, mediaA);
    const B = mk(pidB, mediaB);
    const gate = (x) => (nuovo ? M.puoNegoziare({ haMedia: x.haMedia, mediaFallita: x.fallita }) : x.haMedia);
    let quando = null;
    let t = 0;
    const aggiorna = () => {
      for (const x of [A, B]) {
        if (typeof x.media === "number" && t >= x.media) x.haMedia = true;
        if (x.media === "mai" && t >= 2000) x.fallita = true;
        if (nuovo && x.media === "appeso" && t >= M.SENZA_MEDIA_DOPO_MS) x.fallita = true;
        if (nuovo && typeof x.media === "number" && !x.haMedia && t >= M.SENZA_MEDIA_DOPO_MS) x.fallita = true;
      }
    };
    const offerta = (da, a) => {
      // gestore dell'offerta in arrivo
      if (!gate(a)) {
        a.scartate++;
        return;
      }
      if (!a.pc) a.pc = { locale: false, remoto: false };
      a.pc.remoto = true;
      a.pc.locale = true; // risposta mandata
      if (da.pc) da.pc.remoto = true; // la risposta arriva a chi aveva offerto
      if (quando === null) quando = t;
    };
    const mayInitiate = (da, a) => {
      if (!gate(da) || !(da.pid < a.pid)) return;
      if (!da.pc) {
        da.pc = { locale: true, remoto: false };
        offerta(da, a);
      } else if (!da.pc.remoto) offerta(da, a); // rimanda finché manca la risposta
    };
    for (t = 0; t <= FINE && quando === null; t += PASSO) {
      aggiorna();
      // ognuno saluta; chi riceve prova a offrire (solo se ha il pid minore)
      mayInitiate(A, B);
      mayInitiate(B, A);
    }
    return { quando, scartate: A.scartate + B.scartate };
  }

  const casi = [
    ["ospite con pid MINORE, permesso negato", { pidA: "aaa", mediaA: "mai", pidB: "zzz", mediaB: "subito" }],
    ["ospite con pid MAGGIORE, permesso negato", { pidA: "aaa", mediaA: "subito", pidB: "zzz", mediaB: "mai" }],
    ["ospite con pid minore, richiesta appesa (iPhone)", { pidA: "aaa", mediaA: "appeso", pidB: "zzz", mediaB: "subito" }],
    ["ospite con pid maggiore, richiesta appesa (iPhone)", { pidA: "aaa", mediaA: "subito", pidB: "zzz", mediaB: "appeso" }],
    ["consulente senza media (permesso negato), ospite con media", { pidA: "aaa", mediaA: "subito", pidB: "zzz", mediaB: "mai" }],
  ];
  gruppo("MEETLY · SIMULAZIONE CON DUE FINTI PEER: CHI NON HA MEDIA RESTAVA ISOLATO");
  for (const [nome, k] of casi) {
    const v = simula({ regola: "vecchia", ...k });
    const n = simula({ regola: "nuova", ...k });
    c(`${nome}: regola vecchia, mai collegati in 90 s`, null, v.quando);
    c(`${nome}: regola nuova, si collegano entro 18 s`, true, n.quando !== null && n.quando <= 18_000);
  }

  gruppo("MEETLY · I CASI SANI NON CAMBIANO");
  for (const k of [
    { pidA: "aaa", mediaA: "subito", pidB: "zzz", mediaB: "subito" },
    { pidA: "aaa", mediaA: "subito", pidB: "zzz", mediaB: 6000 },
    { pidA: "aaa", mediaA: 9000, pidB: "zzz", mediaB: "subito" },
    { pidA: "aaa", mediaA: 6000, pidB: "zzz", mediaB: 9000 },
  ]) {
    const v = simula({ regola: "vecchia", ...k });
    const n = simula({ regola: "nuova", ...k });
    c(`media ${k.mediaA}/${k.mediaB}: stesso istante di collegamento (${v.quando} ms)`, v.quando, n.quando);
  }
  const lento = simula({ regola: "vecchia", pidA: "aaa", mediaA: "subito", pidB: "zzz", mediaB: 12_000 });
  c("permesso concesso dopo 12 s: la regola vecchia guariva da sola entro 3 s", true, lento.quando >= 12_000 && lento.quando <= 15_000);
  const v20 = simula({ regola: "vecchia", pidA: "aaa", mediaA: "subito", pidB: "zzz", mediaB: 20_000 });
  const n20 = simula({ regola: "nuova", pidA: "aaa", mediaA: "subito", pidB: "zzz", mediaB: 20_000 });
  c("permesso dopo 20 s: vecchia ≈ 21 s; nuova si collega prima, a 15 s, in sola ricezione", [21_000, 15_000], [v20.quando, n20.quando]);

  // ── gli innesti nel sorgente ────────────────────────────────────────────
  gruppo("MEETLY · GLI INNESTI IN CALL.TSX (LETTI DAL SORGENTE)");
  const src = readFileSync(join(radice, "src/shop/call.tsx"), "utf8");
  const senza = src.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");
  const blocco = (inizio, lungh) => {
    const i = senza.indexOf(inizio);
    return i < 0 ? "" : senza.slice(i, i + lungh);
  };
  c("importa la regola", true, /from "@\/shop\/senza-media"/.test(senza));
  const mi = blocco("async function maybeInitiate(", 400);
  c("maybeInitiate non esce più per `!localStream` da solo", false, /if \(!localStream \|\|/.test(mi));
  c("maybeInitiate usa puoNegoziare", true, /puoNegoziare\(/.test(mi));
  const of = blocco('{ event: "offer" }', 400);
  c("il gestore dell'offerta non scarta più per `!localStream` da solo", false, /!localStream\) return/.test(of));
  c("il gestore dell'offerta usa puoNegoziare", true, /puoNegoziare\(/.test(of));
  const mp = blocco("function makePeer(", 900);
  c("senza media il peer è segnato come «senza media»", true, /peerSenzaMedia\.add\(/.test(mp));
  c("chi offre senza media crea due transceiver recvonly (chi risponde no)", [2, 0], [(mi.match(/addTransceiver\(/g) || []).length, (mp.match(/addTransceiver\(/g) || []).length]);
  c("esiste la promozione dei peer senza media", true, /function promuoviPeerSenzaMedia\(/.test(senza));
  const att = blocco("function attachLocalMediaToPeers(", 900);
  c("quando arrivano i media i peer senza media si promuovono in loco", true, /promuoviPeerSenzaMedia\(/.test(att));
  const cam = blocco("async function camAcquire(", 1800);
  c("la camera riaccesa dal pulsante «Riprova» promuove i peer senza media", true, /promuoviPeerSenzaMedia\(/.test(cam));
  const mic = blocco("async function micAcquire(", 1500);
  c("il microfono riacceso promuove i peer senza media", true, /promuoviPeerSenzaMedia\(/.test(mic));
  c("la richiesta fallita apre la sola ricezione (almeno tre punti: ospite x2, consulente)", true, (senza.match(/apriSenzaMedia\(/g) || []).length >= 4);
  const om = blocco("async function openMedia(", 1200);
  c("la richiesta appesa apre la sola ricezione dopo l'attesa", true, /SENZA_MEDIA_DOPO_MS/.test(om));
}
