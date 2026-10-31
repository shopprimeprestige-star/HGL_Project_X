/** ── PROVE: MEETLY «DENTRO MA SPENTI» (31/10/2026) ────────────────────────────
 *  Regola in src/shop/senza-media.ts; innesti in src/shop/call.tsx.
 *  Due parti: la regola pura, e gli innesti LETTI DAL SORGENTE VERO di call.tsx
 *  (il corpo di ogni funzione si estrae a parentesi bilanciate, quindi un commento
 *  in più non rompe la prova; un innesto tolto sì).
 *  Il WebRTC vero (offerta senza media, promozione in loco) si prova in un browser:
 *  vedi commesse/2026-10-31-meetly-connessione/prove-webrtc/LEGGIMI.md.
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveMeetlyStallo(mod, { c, gruppo, radice }) {
  const M = mod["shop/senza-media"];

  gruppo("MEETLY · SI NEGOZIA SE I MEDIA CI SONO O È CERTO CHE NON CI SARANNO");
  c("con i media: sì", true, M.puoNegoziare({ haMedia: true, mediaFallita: false }));
  c("con i media e flag fallita: sì", true, M.puoNegoziare({ haMedia: true, mediaFallita: true }));
  c("in attesa del permesso: no (comportamento di sempre)", false, M.puoNegoziare({ haMedia: false, mediaFallita: false }));
  c("media falliti o appesi: sì, in sola ricezione", true, M.puoNegoziare({ haMedia: false, mediaFallita: true }));
  c("l'attesa prima di collegarsi senza media è quindici secondi", 15_000, M.SENZA_MEDIA_DOPO_MS);

  gruppo("MEETLY · GLI INNESTI IN CALL.TSX (LETTI DAL SORGENTE)");
  const src = readFileSync(join(radice, "src/shop/call.tsx"), "utf8");
  const senza = src.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");
  //  Il corpo della funzione: dalla prima graffa dopo la firma alla sua chiusa.
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
  const conta = (t, re) => (t.match(re) || []).length;

  c("importa la regola", true, /from "@\/shop\/senza-media"/.test(senza));
  const mi = corpo("async function maybeInitiate(");
  c("maybeInitiate non esce più per `!localStream` da solo", false, /if \(!localStream \|\|/.test(mi));
  c("maybeInitiate usa puoNegoziare; chi offre senza media crea due transceiver recvonly", [true, 2], [/puoNegoziare\(/.test(mi), conta(mi, /addTransceiver\(/g)]);
  c("il gestore dell'offerta usa puoNegoziare e non più `!localStream` da solo", [true, false], [
    /payload\?\.to !== S\.myPid \|\| !puoNegoziare\(/.test(senza),
    /payload\?\.to !== S\.myPid \|\| !localStream\)/.test(senza),
  ]);
  const mp = corpo("function makePeer(");
  c("makePeer segna il peer nato senza media, e non crea transceiver (chi risponde usa quelli dell'offerta)", [true, 0], [/peerSenzaMedia\.add\(/.test(mp), conta(mp, /addTransceiver\(/g)]);

  const pr = corpo("function promuoviPeerSenzaMedia(");
  c("la promozione decide per transceiver e aggancia con addTrack (non replaceTrack: servirebbe il flusso)", [true, true, false], [
    /getTransceivers\(\)/.test(pr),
    /pc\.addTrack\(t, ls\)/.test(pr),
    /replaceTrack|\.direction = /.test(pr),
  ]);
  c("la promozione rinegozia con `restart` e rimanda se resta senza risposta", [true, true], [/restart: true/.test(pr), /have-local-offer/.test(pr)]);
  c("la promozione riprova se l'altro sta offrendo (have-remote-offer)", true, /have-remote-offer/.test(pr));
  c("promozione dentro setLocalTrack (camera, microfono, schermo, segnaposto)", true, /promuoviPeerSenzaMedia\(\)/.test(corpo("function setLocalTrack(")));
  c("…e non più sparsa in camAcquire/micAcquire", [false, false], [
    /promuoviPeerSenzaMedia/.test(corpo("async function camAcquire(")),
    /promuoviPeerSenzaMedia/.test(corpo("async function micAcquire(")),
  ]);
  c("attachLocalMediaToPeers promuove e non ricostruisce i peer in sola ricezione", [true, true], [
    /promuoviPeerSenzaMedia\(\)/.test(corpo("function attachLocalMediaToPeers(")),
    /peerSenzaMedia\.has\(pid\)\) continue/.test(corpo("function attachLocalMediaToPeers(")),
  ]);
  c("il controllo della voce salta i peer in sola ricezione", true, /peerSenzaMedia\.has\(pid\)\) continue;\s*const snd =/.test(senza));

  const om = corpo("async function openMedia(");
  c("apriSenzaMedia: definizione + una sola chiamata (nell'helper di openMedia), usato da timer ed errore", [2, 2], [conta(senza, /apriSenzaMedia\(/g), conta(om, /senzaMedia\(/g)]);
  c("openMedia: timer sull'attesa e controllo della generazione", [true, true], [/SENZA_MEDIA_DOPO_MS/.test(om), /generazione === generazioneMedia/.test(om)]);
  c("openMedia: a media aperti il flag torna falso", true, /mediaFallita = false/.test(om));

  const td = corpo("function teardownMedia(");
  c("teardownMedia pulisce: set, flag, generazione", [true, true, true], [
    /peerSenzaMedia\.clear\(\)/.test(td),
    /mediaFallita = false/.test(td),
    /generazioneMedia\+\+/.test(td),
  ]);
  c("removePeer toglie il peer dal set", true, /peerSenzaMedia\.delete\(pid\)/.test(corpo("function removePeer(")));
  c("resetRoster svuota il set", true, /peerSenzaMedia\.clear\(\)/.test(corpo("function resetRoster(")));
}
