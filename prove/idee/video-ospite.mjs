/** ── PROVE: IL VIDEO CONDIVISO IN MEETLY SI VEDE SU OGNI TELEFONO (17/11/2026) ──
 *  Commessa 2026-11-17-meetly-video-ospiti. Regola in src/shop/video-ospite.ts,
 *  innesti in src/routes/presenta.tsx (lato ospite).
 *  Guasto: sui telefoni che rifiutano la partenza anche in muto (iPhone in
 *  Risparmio energetico, browser dentro WhatsApp/Instagram) il video restava
 *  fermo e vuoto, e l'unico aiuto era «Attiva l'audio».
 *  Due parti: la regola, provata con elementi finti (nessun browser); gli
 *  innesti, LETTI DAL SORGENTE VERO (un commento in più non rompe la prova, un
 *  innesto tolto sì). Il comportamento sul telefono vero si guarda sul telefono.
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Un <video> finto: `risposte` dice, a ogni play(), se riesce (null) o con che errore fallisce. */
function finto(risposte) {
  const v = {
    muted: false,
    chiamate: [],
    play() {
      v.chiamate.push(v.muted);
      const r = risposte.length ? risposte.shift() : null;
      if (r === "senza-promessa") return undefined;
      return r ? Promise.reject(Object.assign(new Error("x"), { name: r })) : Promise.resolve();
    },
  };
  return v;
}

export async function proveVideoOspite(mod, { c, gruppo, radice }) {
  const V = mod["shop/video-ospite"];

  gruppo("VIDEO OSPITE · COME PARTE, E COME SI DICE QUANDO NON PARTE");
  let v = finto([null]);
  c("telefono permissivo: parte con l'audio", [{ esito: "partito", motivo: "" }, false], [await V.avviaVideoOspite(v, true), v.muted]);
  v = finto(["NotAllowedError", null]);
  c("audio negato, muto concesso: gira in muto (serve «Attiva l'audio»)", [{ esito: "muto", motivo: "NotAllowedError" }, true, [false, true]], [await V.avviaVideoOspite(v, true), v.muted, v.chiamate]);
  v = finto(["NotAllowedError", "NotAllowedError"]);
  c("negato anche in muto (iPhone Risparmio energetico): BLOCCATO", { esito: "bloccato", motivo: "NotAllowedError" }, await V.avviaVideoOspite(v, true));
  v = finto(["NotAllowedError"]);
  c("senza audio voluto e partenza negata: bloccato, un solo tentativo", [{ esito: "bloccato", motivo: "NotAllowedError" }, 1], [await V.avviaVideoOspite(v, false), v.chiamate.length]);
  v = finto([null]);
  c("senza audio voluto: parte muto e NON conta come ripiego", [{ esito: "partito", motivo: "" }, true], [await V.avviaVideoOspite(v, false), v.muted]);
  v = finto(["AbortError"]);
  c("AbortError (cambiato video mentre partiva): interrotto, l'audio NON si toglie", [{ esito: "interrotto", motivo: "AbortError" }, false, 1], [await V.avviaVideoOspite(v, true), v.muted, v.chiamate.length]);
  v = finto(["NotAllowedError", "AbortError"]);
  c("AbortError anche al secondo tentativo: interrotto, non bloccato", "interrotto", (await V.avviaVideoOspite(v, true)).esito);
  v = finto(["senza-promessa"]);
  c("browser vecchio che non restituisce la promessa: partito", "partito", (await V.avviaVideoOspite(v, true)).esito);
  v = finto([]); v.play = () => Promise.reject("testo");
  c("errore strano (una stringa, non un oggetto): bloccato, mai un'eccezione", [{ esito: "bloccato", motivo: "errore" }], [await V.avviaVideoOspite(v, false)]);

  gruppo("VIDEO OSPITE · LE FRASI DEL DIARIO NON PORTANO NÉ NOMI NÉ INDIRIZZI");
  const frasi = [
    V.motivoBloccato("NotAllowedError"),
    V.motivoErroreMedia(4),
    V.motivoStallo(0, 3),
  ];
  c("bloccato", "Video ospite bloccato: NotAllowedError", frasi[0]);
  c("errore del media con il codice", "Video ospite non riproducibile: errore del media codice 4", frasi[1]);
  c("stallo con stato e rete", "Video ospite in stallo: nessun fotogramma dopo 6 s (stato 0, rete 3)", frasi[2]);
  c("codice assente: 0, mai «undefined»", "Video ospite non riproducibile: errore del media codice 0", V.motivoErroreMedia(undefined));
  c("nessuna frase contiene un indirizzo", false, frasi.some((f) => /https?:|\.mp4|supabase/i.test(f)));
  c("un nome di errore lunghissimo si taglia", true, V.motivoBloccato("x".repeat(500)).length < 80);

  gruppo("VIDEO OSPITE · GLI INNESTI IN PRESENTA.TSX (LETTI DAL SORGENTE)");
  const grezzo = readFileSync(join(radice, "src/routes/presenta.tsx"), "utf8");
  const src = grezzo.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");
  const corpo = (firma) => {
    const i = src.indexOf(firma);
    if (i < 0) return "";
    const a = src.indexOf("{", src.indexOf(")", i + firma.length));
    let n = 0;
    for (let k = a; k < src.length; k++) {
      if (src[k] === "{") n++;
      else if (src[k] === "}" && --n === 0) return src.slice(a, k + 1);
    }
    return "";
  };
  const ospite = src.slice(src.indexOf("const gStyle"), src.indexOf("if (gated)"));
  const videoOspite = (/<video ref=\{videoRef\}[\s\S]*?\/>/.exec(ospite) || [""])[0];
  const sync = corpo("const syncTo = (");

  c("importa la regola", true, /from "@\/shop\/video-ospite"/.test(src));
  c("il video dell'ospite chiede il primo fotogramma (iPhone non disegna nulla prima del play) e il caricamento", [true, true], [
    /src=\{current \? conPrimoFotogramma\(current\) : undefined\}/.test(videoOspite),
    /preload="auto"/.test(videoOspite),
  ]);
  c("l'errore del video riporta il codice e NON l'indirizzo del file", [true, false], [
    /motivoErroreMedia\(/.test(videoOspite) || /error\?\.code/.test(videoOspite),
    /\$\{current\}/.test(videoOspite),
  ]);
  c("la partenza passa dalla regola (effetto dell'ospite e syncTo), niente più ripiego a mano", [true, true, false], [
    /avviaVideoOspite\(/.test(src),
    /avvia\(v, /.test(sync),
    /v\.muted = true;\s*v\.play\(\)\.catch/.test(sync),
  ]);
  c("«bloccato» accende il pulsante e lo segnala al diario", [true, true], [
    /setBloccato\(r\.esito === "bloccato"\)/.test(src),
    /segnalaVideoOspite\(motivoBloccato\(/.test(src),
  ]);
  c("il pulsante dice cosa fa: «Tocca per vedere il video», e parte da un gesto", [true, true], [
    /Tocca per vedere il video/.test(ospite),
    /onClick=\{vediVideo\}/.test(ospite),
  ]);
  c("il pulsante c'è solo per un video bloccato", true, /bloccato && current && currentKind === "video"/.test(ospite));
  c("se il consulente mette in pausa, il pulsante sparisce (non si fa partire ciò che lui ha fermato)", true, /if \(!playing\) setBloccato\(false\)|!playing && [\s\S]{0,40}setBloccato\(false\)/.test(sync));
  c("il tocco riallinea il tempo con il consulente", true, /vediVideo = [\s\S]{0,400}send\("vhello"/.test(src));
  c("controllo di stallo: dopo STALLO_DOPO_MS senza dati lo scrive nel diario", [true, true], [
    /STALLO_DOPO_MS/.test(src),
    /segnalaVideoOspite\(motivoStallo\(/.test(src),
  ]);
  c("«Attiva l'audio» resta, ma solo se il video gira già", true, /needTap && current && currentKind === "video"/.test(ospite));
  c("il lettore del consulente non cambia (controlli e anteprima come prima)", true, /<video ref=\{videoRef\} src=\{current\} controls playsInline/.test(src));

  gruppo("VIDEO OSPITE · IL MOTIVO PER CUI SERVE UN PULSANTE NOSTRO");
  const css = readFileSync(join(radice, "src/styles.css"), "utf8");
  c("lo stile globale nasconde il «play» nativo di iOS sui video senza comandi: il rimedio non può essere quello", true, /video::-webkit-media-controls-start-playback-button/.test(css));
}
