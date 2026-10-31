/** ── PROVE: MEETLY SFU · GLI INNESTI IN call.tsx (T5, 31/10/2026) ──────────────
 *  Commessa 2026-10-31-meetly-connessione, PIANO.md §1.3 (i 19 innesti) e §3 T5,
 *  più le note N1, N3 e N4 del capo progetto.
 *
 *  Come funzionano: `call.tsx` è un file di 18 mila righe che non gira in Node,
 *  quindi qui si legge il SORGENTE (senza commenti, stile `chiamate-azzera.mjs`):
 *  chi cancella una guardia o sposta un innesto fa fallire una prova. Dove la
 *  cosa si può eseguire davvero (i campi in più dell'`hello`, `trDichiarato`) si
 *  estrae il testo dal sorgente e lo si FA GIRARE con dati inventati.
 *
 *  ⚠️ Con l'interruttore su «mesh» (di serie) la chiamata deve restare quella di
 *  sempre: ogni innesto è dietro `trasportoSfu()`, falso finché nessuno dichiara
 *  `sfu`. Qui si prova soprattutto questo.
 *
 *  La parte del pannello delle Impostazioni (T4) sta in fondo al file, in
 *  `provePannelloTrasporto`, chiamata dalla funzione principale.
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveMeetlySfuInnesti(mod, { c, gruppo, radice }) {
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");
  const src = senzaCommenti(readFileSync(join(radice, "src/shop/call.tsx"), "utf8"));

  /** Il corpo `{ … }` di una funzione: dall'intestazione, salta i parametri e
   *  chiude alla graffa giusta. Stringa vuota se l'intestazione non c'è. */
  const corpoDi = (intestazione) => {
    const i = src.indexOf(intestazione);
    if (i < 0) return "";
    let j = src.indexOf("(", i);
    for (let d = 0; j < src.length; j++) {
      if (src[j] === "(") d++;
      else if (src[j] === ")" && --d === 0) break;
    }
    const a = src.indexOf("{", j);
    let d = 0;
    for (let k = a; k < src.length; k++) {
      if (src[k] === "{") d++;
      else if (src[k] === "}" && --d === 0) return src.slice(a, k + 1);
    }
    return "";
  };
  /** Il gestore di un evento del canale: fino al gestore successivo. */
  const gestore = (evento) => {
    const i = src.indexOf(`{ event: "${evento}" }`);
    if (i < 0) return "";
    const fine = [src.indexOf('ch.on("broadcast"', i + 10), src.indexOf("ch.subscribe(", i + 10)]
      .filter((x) => x > 0)
      .sort((x, y) => x - y)[0];
    return src.slice(i, fine);
  };
  //  Si confronta senza spazi né virgole finali: il formato lo decide il formattatore, non la prova.
  const norm = (t) => t.replace(/\s+/g, "").replace(/,([)\]}])/g, "$1");
  /** Tutti i frammenti ci sono (nell'ordine dato, se `inOrdine`). */
  const ha = (testo, frammenti, inOrdine = false) => {
    const n = norm(testo);
    let da = 0;
    return frammenti.every((f) => {
      const i = n.indexOf(norm(f), inOrdine ? da : 0);
      if (i >= 0 && inOrdine) da = i + norm(f).length;
      return i >= 0;
    });
  };
  /** La prima istruzione utile di un corpo (dopo la graffa di apertura). */
  const inizio = (corpo, n = 400) => norm(corpo.slice(1, n * 3)).slice(0, n);
  const GUARDIA = "if(trasportoSfu())";

  gruppo("MEETLY SFU · INNESTI IN call.tsx · IL PUNTO DI PARTENZA È MESH");
  c("la sorgente si legge e le funzioni si trovano", true, src.length > 100000 && corpoDi("function makePeer(").length > 500);
  c("`trasporto` parte da «mesh» e `sfu` da null", true,
    ha(src, ['let trasporto: Trasporto = "mesh";', "let sfu: TrasportoSfu | null = null;"]));
  c("`trasportoSfu()` è vero solo se il trasporto è sfu E il modulo esiste", true,
    ha(src, ['const trasportoSfu = () => trasporto === "sfu" && !!sfu;']));
  c("l'import del client SFU e delle regole c'è", true,
    ha(src, ['import { creaTrasportoSfu } from "@/shop/meetly-sfu";', 'from "@/shop/meetly-sfu-regole";']));
  c("nessun `?trasporto` letto nel ramo dell'ospite: `.get(\"trasporto\")` una volta sola, dentro la funzione del consulente",
    [1, true],
    [
      (src.match(/\.get\("trasporto"\)/g) || []).length,
      inizio(corpoDi("async function decidiTrasporto(")).startsWith(norm('if (S.role !== "host" || trasportoDeciso) return;')) &&
        corpoDi("function paramTrasporto(").includes('.get("trasporto")') &&
        ha(corpoDi("async function decidiTrasporto("), ["paramLink: paramTrasporto()"]),
    ]);

  gruppo("MEETLY SFU · INNESTO 4 · makePeer: il pc vero resta com'è nel ramo mesh");
  const mp = corpoDi("function makePeer(");
  c("nel ramo mesh `new RTCPeerConnection({ iceServers: cachedIce })` è identico a oggi", true,
    ha(mp, ["const p = trasportoSfu() ? sfu!.nuovoPeer(pid) : new RTCPeerConnection({ iceServers: cachedIce });"]));
  c("le tracce locali si aggiungono a mano solo in mesh (l'adattatore le pubblica da sé)", true,
    ha(mp, ["if (localStream && !trasportoSfu()) localStream.getTracks().forEach((t) => p.addTrack(t, localStream!));"]));
  c("il resto di makePeer non cambia: ontrack, onicecandidate, onconnectionstatechange restano", true,
    mp.includes("p.ontrack = ") && mp.includes("p.onicecandidate = ") && mp.includes("p.onconnectionstatechange = "));

  gruppo("MEETLY SFU · INNESTI 5, 6a, 6b · le ri-offerte non esistono in SFU");
  c("maybeInitiate: la PRIMA istruzione è la guardia SFU (makePeer + sincronizza, poi esce)", true,
    inizio(corpoDi("async function maybeInitiate("), 200).startsWith(
      norm("if (trasportoSfu()) { if (!localStream) return; makePeer(pid); sorvegliaOspite(pid); sfu!.sincronizza(); return; }"),
    ));
  const ch = corpoDi("function chiediRipresa(");
  c("chiediRipresa: nel timer la ripresa SFU sta DOPO i controlli di stato e PRIMA di reoffer/«riprova»", true,
    ha(ch, [
      'if (st === "connected" && !ancheSeConnessa) return;',
      "if (trasportoSfu()) { sfu!.riprova(pid, ancheSeConnessa); return; }",
      "void reoffer(pid, ancheSeConnessa)",
    ], true) && ha(ch, ["sfu!.riprova(pid, ancheSeConnessa)", 'send("riprova"'], true));
  c("reoffer: la PRIMA istruzione è la guardia (gcRoster lo chiama dritto, senza passare da chiediRipresa)", true,
    inizio(corpoDi("async function reoffer("), 200).startsWith(
      norm("if (trasportoSfu()) { sfu!.riprova(pid, chiestaDalPeer); return; }"),
    ));

  gruppo("MEETLY SFU · INNESTO 7 · offer/answer/ice/riprova/addIce scartati in SFU");
  const gOffer = gestore("offer");
  c("gestore offer: guardia come prima istruzione", true,
    inizio(gOffer.slice(gOffer.indexOf("=> {") + 3), 80).startsWith(GUARDIA + "return;"));
  c("N1 · gestore offer: la guardia è RIPETUTA dentro il `.then(async …)`, prima di makePeer", true,
    ha(gOffer, ["prev.then(async () => {", "if (trasportoSfu()) return;", "makePeer(from)"], true));
  c("gestore answer: guardia", true, inizio(gestore("answer").slice(gestore("answer").indexOf("=> {") + 3), 80).startsWith(GUARDIA + "return;"));
  c("gestore ice: guardia", true, inizio(gestore("ice").slice(gestore("ice").indexOf("=> {") + 3), 80).startsWith(GUARDIA + "return;"));
  c("gestore riprova: guardia", true, inizio(gestore("riprova").slice(gestore("riprova").indexOf("=> {") + 3), 80).startsWith(GUARDIA + "return;"));
  c("addIce: la PRIMA istruzione è la guardia (con un PeerSfu `remoteDescription` finto sarebbe non nullo)", true,
    inizio(corpoDi("async function addIce("), 80).startsWith(GUARDIA + "return;"));

  gruppo("MEETLY SFU · INNESTI 10, 11 · media locali");
  const am = corpoDi("function attachLocalMediaToPeers(");
  c("attachLocalMediaToPeers: in SFU sincronizza ed esce, senza ricostruire pc", true,
    ha(am, ["if (trasportoSfu()) { sfu!.sincronizza(); return; }", "removePeer("], true));
  const rv = corpoDi("async function replaceVideoTrackAll(");
  c("replaceVideoTrackAll (solo se c'è l'SFU: in mesh nessun tick in più) chiama sostituisci(\"video\") PRIMA di toccare i sender, e non lancia mai", true,
    ha(rv, ['if (sfu) await sfu.sostituisci("video", track).catch(() => {});', "for (const pc of peers.values())"], true));
  const ra = corpoDi("async function replaceAudioTrackAll(");
  c("replaceAudioTrackAll (solo se c'è l'SFU) chiama sostituisci(\"audio\") PRIMA di toccare i sender, e non lancia mai", true,
    ha(ra, ['if (sfu) await sfu.sostituisci("audio", track).catch(() => {});', "for (const pc of peers.values())"], true));

  gruppo("MEETLY SFU · INNESTO 16 · espulsione");
  c("kickGuest chiama sfu?.espelli(pid) prima di togliere il pc (il flusso cade sul server, non solo se il browser obbedisce)", true,
    ha(corpoDi("export function kickGuest("), ["sfu?.espelli(pid);", 'removePeer(pid, "kick")'], true));
  c("blockGuest passa da kickGuest (una sola espulsione sul server, non due)", true,
    ha(corpoDi("export async function blockGuest("), ['kickGuest(pid, "blocked")']));

  gruppo("MEETLY SFU · INNESTO 17 · tetto prudente");
  const tv = corpoDi("function tuneVideoSenders(");
  c("il listino è limitato da tettoSfu() solo in SFU; in mesh `Math.min(x, Infinity)` = x", true,
    ha(tv, ["const listino = Math.min(listinoVideo(q.br, S.sharing), trasportoSfu() ? tettoSfu() : Infinity);"]));
  c("tuneVideoSenders nomina l'SFU solo in quella riga", 1, tv.split("\n").filter((r) => /sfu/i.test(r)).length);

  gruppo("MEETLY SFU · INNESTO 2 · l'hello: i campi nuovi sono spread condizionali");
  const sh = corpoDi("function sendHello(");
  c("sendHello: i campi di oggi restano tutti, nello stesso ordine", true,
    ha(sh, [
      "pid: S.myPid,",
      "name: helloName(),",
      "role: S.role,",
      "camOn: S.camOn,",
      "joined: true,",
      "req,",
      "dev: myDeviceId(),",
      "vp: myViewport(),",
      "persona: miaPersonaDi(S.sessionId) || gettoneInMemoria(),",
      "suo: restaSulMioPreventivo(),",
    ], true));
  // Le righe nuove: tutto ciò che sta dopo `suo: …,` e prima della chiusura dell'oggetto.
  const dopoSuo = sh.slice(sh.indexOf("suo: restaSulMioPreventivo(),") + "suo: restaSulMioPreventivo(),".length, sh.lastIndexOf("});"));
  c("…e dopo `suo` ci sono SOLO spread condizionali (tre)", [3, true],
    [(dopoSuo.match(/\.\.\.\(/g) || []).length, /^\s*\.\.\.\(/.test(dopoSuo) && !/^\s*[a-zA-Z]+:/m.test(dopoSuo)]);
  const eseguiHello = (S, trDichiarato, sfu, trasportoSfu = () => false) =>
    new Function("S", "trDichiarato", "sfu", "trasportoSfu", `return {${dopoSuo}};`)(S, trDichiarato, sfu, trasportoSfu);
  const ANN = { s: "sess1", a: "p1-a", v: "p1-v" };
  c("OSPITE a interruttore spento: solo `capSfu` (il solo campo in più, N4a), mai `tr`", { capSfu: true },
    eseguiHello({ role: "viewer" }, () => null, null));
  c("OSPITE che ha già annunciato: capSfu + sfu, mai `tr`", { capSfu: true, sfu: ANN },
    eseguiHello({ role: "viewer" }, () => null, { annuncio: () => ANN }));
  c("CONSULENTE con decisione mesh: l'hello è IDENTICO a oggi, senza `tr` né `capSfu`", {},
    eseguiHello({ role: "host" }, () => null, null));
  c("CONSULENTE in SFU: tr «sfu» e capSfu", { tr: "sfu", capSfu: true },
    eseguiHello({ role: "host" }, () => "sfu", null, () => true));
  c("CONSULENTE in SFU che ha pubblicato: aggiunge anche l'annuncio", { tr: "sfu", capSfu: true, sfu: ANN },
    eseguiHello({ role: "host" }, () => "sfu", { annuncio: () => ANN }, () => true));
  c("CONSULENTE dopo un ripiego: solo tr «mesh»", { tr: "mesh" },
    eseguiHello({ role: "host" }, () => "mesh", null));
  // `trDichiarato` stessa: estratta dal sorgente e fatta girare.
  const mTr = src.match(/const trDichiarato = \(\) =>([^;]*);/);
  const trDich = (S, sfuOn, ripiegoFatto) =>
    new Function("S", "trasportoSfu", "statoAdozione", `return (${mTr ? mTr[1] : "null"});`)(S, () => sfuOn, { ripiegoFatto });
  c("trDichiarato: la funzione si trova nel sorgente", true, !!mTr);
  c("trDichiarato: consulente in SFU → sfu", "sfu", trDich({ role: "host" }, true, false));
  c("trDichiarato: consulente dopo ripiego → mesh", "mesh", trDich({ role: "host" }, false, true));
  c("trDichiarato: consulente che non ha mai usato l'SFU → niente (hello identico a oggi)", null, trDich({ role: "host" }, false, false));
  c("trDichiarato: un OSPITE non dichiara mai (nemmeno se è passato a SFU o ha ripiegato)", [null, null],
    [trDich({ role: "viewer" }, true, false), trDich({ role: "viewer" }, false, true)]);

  gruppo("MEETLY SFU · INNESTO 3 · callstate");
  const SPR = "...(trDichiarato() ? { tr: trDichiarato() } : {})";
  c("broadcastState: `tr` in uno spread condizionale", true, ha(corpoDi("const broadcastState = "), [SPR]));
  c("setSessionLive: `tr` in uno spread condizionale", true, ha(corpoDi("export function setSessionLive("), [SPR]));

  gruppo("MEETLY SFU · INNESTO 8 · il gestore hello");
  const hh = gestore("hello");
  c("l'accordo sul trasporto (solo ospite, solo da un consulente) viene PRIMA della moderazione e di ogni pc", true,
    ha(hh, [
      'if (isViewer() && role === "host") adottaTrasportoDelHost(pid, payload);',
      'const dev = String(payload?.dev || "");',
      "removePeer(",
    ], true));
  c("`viva(pid)` e l'annuncio sono subito PRIMA dell'ultimo maybeInitiate(pid), dietro la guardia SFU", true,
    ha(hh.slice(hh.lastIndexOf("if (trasportoSfu())")), [
      "if (trasportoSfu()) {",
      "sfu!.viva(pid);",
      'if (payload?.sfu && typeof payload.sfu === "object") sfu!.suAnnuncio(pid, payload.sfu);',
      "}",
      "maybeInitiate(pid);",
    ], true) && norm(hh.slice(hh.lastIndexOf("if (trasportoSfu())"))).length < 240);
  c("ospite senza `capSfu` mentre il consulente è in SFU → ripiego «ospite-vecchio» (solo il consulente, dopo l'elenco, prima di viva)", true,
    ha(hh, [
      "upsertRoster(",
      'if (!isViewer() && role === "viewer" && trasportoSfu() && payload?.capSfu !== true) ripiegaSuMesh("ospite-vecchio");',
      "sfu!.viva(pid)",
    ], true));
  const ad = corpoDi("function adottaTrasportoDelHost(");
  c("adottaTrasportoDelHost: usa adottaTrasporto delle regole con l'orologio e «nessun pc connesso» (N1)", true,
    ha(ad, [
      "adottaTrasporto(statoAdozione, { pid, tr: payload?.tr }, { adesso: Date.now(), nessunPcConnesso: !anyConnected() })",
      "statoAdozione = e.stato;",
      'if (e.azione === "sfu") passaASfu();',
      'else if (e.azione === "mesh") ripiegaSuMesh(e.motivo);',
    ], true));

  gruppo("MEETLY SFU · INNESTO 9 · «trasportofallito» dell'ospite");
  const tf = gestore("trasportofallito");
  c("il gestore esiste ed è solo del consulente, solo in SFU", true, ha(tf, ["if (isViewer() || !trasportoSfu()) return;"]));
  c("accetta solo un pid del roster, una volta per pid (il canale non è autenticato)", true,
    ha(tf, ["S.roster.some((r) => r.pid === pid)", "trasportoFallitoDa.has(pid)", "trasportoFallitoDa.add(pid)"], true));
  c("conferma breve, poi ripiega: l'ospite ha già lasciato l'SFU, quindi il suo PeerSfu «connected» NON la ferma", true,
    ha(tf, ["setTimeout(", "if (!trasportoSfu()) return;", 'ripiegaSuMesh("ospite")', "CONFERMA_OSPITE_MS"], true) &&
      !/connectionState/.test(tf));

  gruppo("MEETLY SFU · IL CONSULENTE NON ASPETTA PER SEMPRE UN OSPITE CHE NON SI AGGANCIA");
  const sv = corpoDi("function sorvegliaOspite(");
  c("sorvegliaOspite esiste, è solo del consulente e parte una volta per ospite", true,
    sv.length > 50 && ha(sv, ["if (isViewer() || attesaOspite.has(pid)) return;", "attesaOspite.set(pid, window.setTimeout("], true));
  c("controlla UNA volta per ospite: la voce non si toglie allo scatto, quindi non si riarma a ogni giro", false, /attesaOspite\.delete\(pid\);\s*if \(!trasportoSfu/.test(src));
  c("allo scatto: se è ancora SFU, l'ospite è nel roster e non è collegato, ripiega con motivo «ospite»", true,
    ha(sv, ["trasportoSfu()", "S.roster.some((r) => r.pid === pid)", 'peers.get(pid)?.connectionState !== "connected"', 'ripiegaSuMesh("ospite")', "ATTESA_OSPITE_MS"], true));
  c("l'attesa è ~30 s", true, /const ATTESA_OSPITE_MS = 30_000;/.test(src));
  c("è nel ramo SFU di maybeInitiate (una sola volta) e non nel ramo mesh", [true, 1],
    [ha(corpoDi("async function maybeInitiate("), ["if (trasportoSfu()) {", "sorvegliaOspite(pid);", "if (!localStream || !(S.myPid < pid)) return;"], true),
      (corpoDi("async function maybeInitiate(").match(/sorvegliaOspite\(/g) || []).length]);
  c("removePeer ripulisce il timer di quell'ospite", true, ha(corpoDi("function removePeer("), ["attesaOspite.get(pid)", "attesaOspite.delete(pid)"]));
  c("fermaSorveglianza ferma e svuota tutti i timer", true, ha(corpoDi("function fermaSorveglianza("), ["attesaOspite.forEach((t) => window.clearTimeout(t));", "attesaOspite.clear();"], true));
  c("azzeraTrasporto ripulisce i timer", true, inizio(corpoDi("function azzeraTrasporto("), 60).startsWith("fermaSorveglianza();"));
  c("ripiegaSuMesh ripulisce i timer (dopo il ripiego non servono più)", true, ha(corpoDi("function ripiegaSuMesh("), ["fermaSorveglianza();", "chiudiPeerSenzaRoster();"], true));

  gruppo("MEETLY SFU · INNESTI 12, 14, 18 · decisione, passaggio a SFU e ripiego");
  const om = corpoDi("async function openMedia(");
  c("openMedia: la lettura dell'interruttore parte PRIMA di prefetchIce e di apriMedia, solo per il consulente", true,
    ha(om, ['const lettura = S.role === "host" && !trasportoDeciso ? leggiInterruttore() : null;', "await prefetchIce()", "apriMedia("], true));
  c("openMedia: l'interruttore non si rilegge se la decisione di questa chiamata è già presa", true,
    ha(om, ["!trasportoDeciso ? leggiInterruttore()"]));
  c("openMedia: nessun await sulla lettura prima di apriMedia (non aggiunge attesa all'apertura)", true,
    !/await (lettura|leggiInterruttore|decidiTrasporto)/.test(om.slice(0, om.indexOf("apriMedia("))));
  c("openMedia: la decisione si attende solo subito prima dell'ULTIMO sendHello(true), dopo i media", true,
    ha(om, ['collegaVoceAlRegistratore(s, "io")', "if (lettura) await decidiTrasporto(lettura);", "sendHello(true);", "S.roster.forEach((r) => maybeInitiate(r.pid));", "return s;"], true) &&
      norm(om.slice(om.lastIndexOf("if (lettura)"), om.lastIndexOf("sendHello(true)"))).length < 200);
  c("openMedia: un ospite già passato a SFU avvia l'invio con i media appena aperti", true, ha(om, ["else sfu?.avvia(s);"]));
  const li = corpoDi("function leggiInterruttore(");
  c("leggiInterruttore: GET dello stato, tetto LETTURA_INTERRUTTORE_MS (1,5 s), mai un'eccezione", true,
    ha(li, ["/api/public/meetly-sfu?stato=1", "LETTURA_INTERRUTTORE_MS", "AbortController", ".catch(", "pronto: false"]));
  const dt = corpoDi("async function decidiTrasporto(");
  c("decidiTrasporto: usa sceltaTrasporto, cancella il segno quando richiesto, poi dichiara, poi passa a SFU, poi scrive il diario", true,
    ha(dt, ["sceltaTrasporto({", "cancellaSegno", "dichiaraSfu(", "passaASfu();", "diarioTrasporto(`trasporto=${trasporto}"], true));
  c("decidiTrasporto: se dichiarare fallisce resta MESH senza annunciare niente (esce prima di passaASfu)", true,
    ha(dt, ["if (!(await dichiaraSfu(codice, sc.motivo === \"link-sfu\"))) {", "return;", "}", "passaASfu();"], true));
  c("decidiTrasporto: decide UNA volta per chiamata (`trasportoDeciso`)", true,
    ha(dt, ["trasportoDeciso", "trasportoDeciso = true;"], true) && ha(corpoDi("function azzeraTrasporto("), ["trasportoDeciso = false;"]));
  const dc = corpoDi("async function dichiaraSfu(");
  c("dichiaraSfu: POST con la sessione del consulente, azione «dichiara», con tetto di tempo, mai un'eccezione", true,
    ha(dc, ['azione: "dichiara"', 'credentials: "same-origin"', "AbortController", "catch {", "return false;"]));
  const ps = corpoDi("function passaASfu(");
  c("passaASfu: crea il modulo con le credenziali della scheda (innesto 18); se la creazione lancia, resta mesh", true,
    ha(ps, ["creaTrasportoSfu({", "credenziali: () => ({ dev: myDeviceId(), segreto: mioSegreto() })", "catch (e)", "dopoRipiegoLocale(statoAdozione)", "chiudiPeerSenzaRoster();"], true));
  c("passaASfu: chiude i pc già nati SENZA toccare il roster e riparte da maybeInitiate", true,
    ha(ps, ["chiudiPeerSenzaRoster();", "S.roster.forEach((r) => maybeInitiate(r.pid));"], true) && !ps.includes("removePeer("));
  c("passaASfu: l'annuncio rimanda subito l'hello; un guasto ripiega, e l'ospite lo dice al consulente", true,
    ha(ps, ["mio.onAnnuncio(() => sendHello());", "mio.onFallito((m) => {", "if (sfu !== mio) return;", "ripiegaSuMesh(m);", 'send("trasportofallito"'], true));
  c("passaASfu: `ice` rispetta il contratto del client (una promessa di server ICE) e `log` è console.log senza raddoppiare il prefisso", true,
    ha(ps, ["ice: async () => cachedIce", "log: console.log"], true) && !ps.includes('console.log("[SFU]"'));
  c("passaASfu: avvia l'invio se i media ci sono già", true, ha(ps, ["if (localStream) mio.avvia(localStream);"]));
  const rm = corpoDi("function ripiegaSuMesh(");
  c("ripiegaSuMesh: si può chiamare due volte (un solo verso, senza effetti doppi)", true,
    inizio(rm, 120).startsWith(norm('if (trasporto !== "sfu" && !sfu) return;')));
  c("ripiegaSuMesh: chiude senza toccare il roster, chiude il modulo, torna a mesh, ricorda il ripiego (N1)", true,
    ha(rm, ["chiudiPeerSenzaRoster();", "sfu?.chiudiTutto();", "sfu = null;", 'trasporto = "mesh";', "statoAdozione = dopoRipiegoLocale(statoAdozione);"], true) &&
      !rm.includes("removePeer("));
  c("ripiegaSuMesh: segno di 30 minuti e riga nel diario (solo consulente), poi nuovo hello e riconnessione in mesh", true,
    ha(rm, ["if (!isViewer()) {", "hg_tr_", "mesh@", "diarioTrasporto(", "sendHello(true);", "S.roster.forEach((r) => maybeInitiate(r.pid));"], true));

  gruppo("MEETLY SFU · INNESTO 13 · la fine della chiamata chiude l'SFU");
  c("azzeraTrasporto: chiudiTutto, sfu null, trasporto mesh, accordo azzerato", true,
    ha(corpoDi("function azzeraTrasporto("), ["sfu?.chiudiTutto();", "sfu = null;", 'trasporto = "mesh";', "statoAdozione = nuovoStatoAdozione();", "trasportoFallitoDa.clear();"], true));
  c("resetRoster chiama azzeraTrasporto()", true, corpoDi("function resetRoster(").includes("azzeraTrasporto();"));
  c("teardownMedia chiama azzeraTrasporto() (anche a uscita forzata: la chiusura ha il suo `esci`)", true,
    corpoDi("function teardownMedia(").includes("azzeraTrasporto();"));
  c("removePeer non cambia: p.close() chiama già l'adattatore", true, !/sfu/i.test(corpoDi("function removePeer(")));

  gruppo("MEETLY SFU · INNESTO 15 · diagnosi");
  const dsn = corpoDi("export function debugSnapshot(");
  c("debugSnapshot ha la riga del trasporto, con lo stato del modulo quando c'è", true,
    ha(dsn, ["`trasporto=${trasporto}${", "sfu.stato().pub", "sfu.stato().ricostruzioni"]));

  gruppo("MEETLY SFU · CIÒ CHE NON SI TOCCA");
  for (const [nome, intest] of [
    ["send", "const send = "],
    ["sondaBanda", "function sondaBanda("],
    ["sampleUsage", "function sampleUsage("],
    ["gcRoster", "function gcRoster("],
  ]) {
    const corpo = intest.startsWith("const") ? src.slice(src.indexOf(intest), src.indexOf(intest) + 200) : corpoDi(intest);
    c(`${nome} esiste e NON nomina l'SFU (l'adattatore deve bastare)`, [true, false],
      [corpo.length > 30, /\bsfu\b|trasportoSfu|tettoSfu|PeerSfu/.test(corpo)]);
  }

  gruppo("MEETLY SFU · DEPLOY.md");
  const deploy = readFileSync(join(radice, "DEPLOY.md"), "utf8");
  c("DEPLOY.md nomina i due segreti, con l'app SEPARATA dal webinar e il comando wrangler", true,
    /\| `MEETLY_SFU_APP_ID` \|/.test(deploy) && /\| `MEETLY_SFU_APP_TOKEN` \|/.test(deploy) &&
      /SEPARATA da quella del webinar/.test(deploy) && /wrangler secret put MEETLY_SFU_APP_ID/.test(deploy) && /wrangler secret put MEETLY_SFU_APP_TOKEN/.test(deploy));
  c("DEPLOY.md dice di provare a mano iPhone e rete strozzata prima di accendere (N5)", true, /iPhone/.test(deploy) && /rete strozzata/.test(deploy));
  c("DEPLOY.md scrive il limite noto di espelli (abbonamento già negoziato)", true, /non chiude\s+(?:>\s*)?un abbonamento Cloudflare già negoziato/.test(deploy));
  c("DEPLOY.md non contiene valori: nessuna stringa lunga esadecimale", false, /\b[0-9a-f]{32,}\b/i.test(deploy));

  //  Il pannello delle Impostazioni (T4): la sua funzione sta in fondo al file.
  provePannelloTrasporto({ c, gruppo, radice });
}

import { readFileSync as leggiFileT4 } from "node:fs";
import { join as uniscT4 } from "node:path";

/** ── T4 · IL PANNELLO «COME VIAGGIANO AUDIO E VIDEO» ───────────────────────────
 *  Lettura del sorgente (il progetto non ha un ambiente da browser per i componenti): si guarda
 *  quello che il pannello fa e quello che NON deve fare. Il comportamento a schermo è provato
 *  a mano con Playwright (schermate nella cartella del collaudo). */
function provePannelloTrasporto({ c, gruppo, radice }) {
  gruppo("MEETLY SFU · IL PANNELLO DELL'INTERRUTTORE (T4)");
  const leggi = (p) => leggiFileT4(uniscT4(radice, p), "utf8");
  const sorgente = leggi("src/crm/ImpostazioneTrasporto.tsx");
  const meetly = leggi("src/crm/ImpostazioniMeetly.tsx");
  //  I commenti spiegano le regole e nominano cose che il codice non deve contenere: si guarda il codice.
  const codice = sorgente.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");

  //  1. Nessun segreto, nessun valore: solo «pronto» sì/no.
  c("il pannello non nomina né maneggia i segreti", false, /appSecret|MEETLY_SFU_APP|APP_TOKEN|process\.env|Authorization|Bearer/i.test(sorgente));
  c("nessun letterale lungo che somigli a una chiave", false, /["'`][A-Za-z0-9_-]{32,}["'`]/.test(codice));
  c("non legge né mostra altro che `pronto` e `trasporto`", true, /j\.pronto/.test(codice) && /j\.trasporto/.test(codice) && !/j\.(appId|token|chiave|secret)/i.test(codice));

  //  2. Di serie mesh: riga assente, illeggibile o valore strano = mesh.
  c("stato iniziale: scelta e salvato sono mesh", true, /useState<Trasporto>\("mesh"\)[\s\S]*useState<Trasporto>\("mesh"\)/.test(codice));
  c("solo «sfu» esatto vale sfu, il resto è mesh", true, /j\.trasporto === "sfu" \? "sfu" : "mesh"/.test(codice));
  c("senza lettura riuscita `pronto` resta falso", true, /useState\(false\)/.test(codice) && /setPronto\(j\.pronto === true\)/.test(codice));

  //  3. Senza chiavi la scelta SFU è spenta, con la ragione scritta (non un tooltip) e non si salva.
  c("la voce SFU è disabilitata quando `pronto` è falso", true, /value="sfu"[\s\S]{0,80}disabled=\{!pronto\}/.test(codice));
  c("senza chiavi il selezionato è mesh, anche se la riga dice sfu", true, /selezionato: Trasporto = pronto \? scelto : "mesh"/.test(codice));
  c("la ragione è scritta accanto, in parole semplici", true, /Chiavi mancanti: il nuovo sistema resta spento/.test(sorgente) && /\{!pronto && \(/.test(codice));
  c("la ragione non è un tooltip", false, /title=\{|<Tooltip|data-tooltip/.test(codice));
  c("salva rifiuta sfu senza chiavi prima ancora di chiamare la rotta", true, /if \(selezionato === "sfu" && !pronto\) return;[\s\S]*fetchCRM\(ROTTA, \{/.test(codice));
  c("il suggerimento ?trasporto=sfu si mostra solo con le chiavi", true, /\{pronto && \([\s\S]{0,220}\?trasporto=sfu/.test(codice));

  //  4. Il contratto con la rotta di T2.
  c("legge da GET ?stato=1 sulla rotta pubblica", true, /ROTTA = "\/api\/public\/meetly-sfu"/.test(codice) && /`\$\{ROTTA\}\?stato=1`/.test(codice));
  c("scrive con POST azione «config» e il solo campo `trasporto`", true, /method: "POST"/.test(codice) && /JSON\.stringify\(\{ azione: "config", trasporto: selezionato \}\)/.test(codice));
  c("il 409 non-configurato diventa una frase, non un codice", true, /non-configurato[\s\S]{0,160}Mancano le chiavi/.test(codice));
  c("dopo un errore rilegge lo stato vero", true, /toast\.error[\s\S]{0,160}void leggi\(\)/.test(codice));

  //  5. Parole per il titolare: le due scelte, l'avviso, nessun «Prova».
  c("le due scelte hanno i nomi decisi", true, /Diretto tra i partecipanti \(come oggi\)/.test(sorgente) && /Tramite i server Cloudflare \(in prova\)/.test(sorgente));
  c("avviso: vale per le nuove consulenze", true, /Vale per le nuove consulenze; quelle già avviate restano come sono/.test(sorgente));
  c("titolo del pannello", true, /Come viaggiano audio e video/.test(sorgente));
  c("niente pulsante «Prova»", false, />\s*Prova\b/.test(sorgente));
  c("stati: caricamento ed errore di lettura hanno la loro frase", true, /carico \?/.test(codice) && /Non riesco a leggere come viaggiano audio e video/.test(sorgente) && /Riprova/.test(sorgente));

  //  5b. Nessuna promessa non provata sulle reti (il comportamento con un abbonato lento è ignoto, N5).
  c("niente promesse sul 4G o sulle reti d'ufficio", false, /4G|\bufficio\b|può aiutare/i.test(codice));
  c("la descrizione dice solo a cosa serve", true, /È pensato per le reti che\s+bloccano il collegamento diretto/.test(sorgente));

  //  6. L'innesto in ImpostazioniMeetly.tsx sono solo due righe (import e montaggio).
  c("ImpostazioniMeetly importa e monta il pannello", true, /import \{ ImpostazioneTrasporto \} from "\.\/ImpostazioneTrasporto";/.test(meetly) && /<ImpostazioneTrasporto \/>/.test(meetly));
  c("e lo monta una volta sola", 1, (meetly.match(/<ImpostazioneTrasporto \/>/g) || []).length);
}
