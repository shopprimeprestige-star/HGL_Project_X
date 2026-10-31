/** ── PROVE: MEETLY SFU · LE REGOLE PURE (T1, 31/10/2026) ─────────────────────
 *  Commessa 2026-10-31-meetly-connessione, Parte B: i media della consulenza
 *  possono passare dall'SFU di Cloudflare invece che da una connessione per
 *  coppia. Qui le regole che non toccano né rete né browser: come si sceglie il
 *  trasporto, come i due lati si mettono d'accordo, quando un partecipante
 *  «c'è» ancora, quando si ricostruisce e quando si ripiega, chi può abbonarsi
 *  a cosa. Modulo vero: src/shop/meetly-sfu-regole.ts (impacchettato da
 *  prove.mjs). Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveMeetlySfuRegole(mod, { c, gruppo, radice }) {
  const R = mod["shop/meetly-sfu-regole"];
  const RIL = mod["shop/resta-in-lista"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");
  const T0 = 1_800_000_000_000;

  /* ── PID E NOMI DELLE TRACCE ─────────────────────────────────────────── */
  gruppo("MEETLY SFU · PID E NOMI DELLE TRACCE");
  c("un pid come quelli di call.tsx è valido", true, R.pidValido("k3j9x0ab"));
  c("4 e 16 caratteri: i limiti sono dentro", [true, true], [R.pidValido("abcd"), R.pidValido("a".repeat(16))]);
  c("3 e 17 caratteri: fuori", [false, false], [R.pidValido("abc"), R.pidValido("a".repeat(17))]);
  c(
    "maiuscole, trattino, spazio e invio finale: no",
    [false, false, false, false],
    [R.pidValido("ABCD1234"), R.pidValido("abc-1234"), R.pidValido("abcd 123"), R.pidValido("abcd1234\n")],
  );
  c("non-stringhe: no", [false, false, false], [R.pidValido(undefined), R.pidValido(12345678), R.pidValido(null)]);
  c("i nomi delle tracce: <pid>-a e <pid>-v", { audio: "k3j9x0ab-a", video: "k3j9x0ab-v" }, R.nomiTracce("k3j9x0ab"));
  let lancio = "";
  try {
    R.nomiTracce("NO");
  } catch (e) {
    lancio = String(e?.message || e);
  }
  c("un pid fuori formato non produce nomi: lancia", true, /pid/i.test(lancio));
  //  Mille pid casuali (generatore fisso: la prova deve dare lo stesso esito sempre).
  let seme = 12345;
  const casuale = () => ((seme = (seme * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const alfabeto = "abcdefghijklmnopqrstuvwxyz0123456789";
  let andatiBene = 0;
  for (let i = 0; i < 1000; i++) {
    const lung = 4 + Math.floor(casuale() * 13);
    let pid = "";
    for (let k = 0; k < lung; k++) pid += alfabeto[Math.floor(casuale() * alfabeto.length)];
    const n = R.nomiTracce(pid);
    const a = R.pidDaNomeTraccia(n.audio);
    const v = R.pidDaNomeTraccia(n.video);
    if (a?.pid === pid && a.kind === "audio" && v?.pid === pid && v.kind === "video") andatiBene++;
  }
  c("1000 pid: nome → pid e tipo, andata e ritorno", 1000, andatiBene);
  c(
    "nomi fuori formato: nessun pid",
    [null, null, null, null, null, null, null, null],
    ["abcd1234-x", "abcd1234", "-a", "abcd1234-a-a", "ABCD1234-a", "abc-a", `${"a".repeat(17)}-v`, undefined].map((n) =>
      R.pidDaNomeTraccia(n),
    ),
  );

  /* ── CHE TRASPORTO SI USA (§2.3) ─────────────────────────────────────── */
  gruppo("MEETLY SFU · SCELTA DEL TRASPORTO (tabella di verità)");
  const sc = (x) => {
    const r = R.sceltaTrasporto({ ruolo: "consulente", paramLink: null, segnoRipiego: false, interruttore: "mesh", pronto: true, ...x });
    return [r.trasporto, r.motivo, r.cancellaSegno];
  };
  c("niente di particolare: mesh", ["mesh", "default", false], sc({}));
  c("interruttore sfu e segreti presenti: sfu", ["sfu", "interruttore", false], sc({ interruttore: "sfu" }));
  c("interruttore sfu ma segreti mancanti: mesh, e lo dice", ["mesh", "interruttore-senza-segreti", false], sc({ interruttore: "sfu", pronto: false }));
  c("riga dell'interruttore assente: mesh", "mesh", sc({ interruttore: undefined })[0]);
  c("?trasporto=mesh batte l'interruttore sfu", ["mesh", "link-mesh", false], sc({ paramLink: "mesh", interruttore: "sfu" }));
  c("?trasporto=sfu con interruttore mesh: sfu (e toglie il segno, se c'è)", ["sfu", "link-sfu", true], sc({ paramLink: "sfu" }));
  c("?trasporto=sfu senza segreti: mesh, e dice perché", ["mesh", "link-sfu-senza-segreti", true], sc({ paramLink: "sfu", pronto: false }));
  c("il segno di ripiego tiene in mesh anche se l'interruttore è sfu", ["mesh", "segno-ripiego", false], sc({ segnoRipiego: true, interruttore: "sfu" }));
  //  ⚠️ Obiezione 11 del revisore: l'esplicito batte il segno, altrimenti chi riprova
  //   col link giusto resta in mesh senza saperlo.
  c("L'ESPLICITO BATTE IL SEGNO: ?trasporto=sfu e segno → sfu, il segno si cancella", ["sfu", "link-sfu", true], sc({ paramLink: "sfu", segnoRipiego: true }));
  c("…?trasporto=sfu senza segreti: resta mesh e il segno si cancella comunque", ["mesh", "link-sfu-senza-segreti", true], sc({ paramLink: "sfu", segnoRipiego: true, pronto: false }));
  c("?trasporto=mesh col segno: mesh per il link (non cancella il segno)", ["mesh", "link-mesh", false], sc({ paramLink: "mesh", segnoRipiego: true }));
  c("il parametro si legge senza badare a maiuscole e spazi", "sfu", sc({ paramLink: " SFU " })[0]);
  c("valori strani nel parametro: come se non ci fosse", ["mesh", "default", false], sc({ paramLink: "1" }));
  c("…e l'interruttore decide", "sfu", sc({ paramLink: "boh", interruttore: "sfu" })[0]);
  for (const [nome, x] of [
    ["ospite con ?trasporto=sfu", { paramLink: "sfu", interruttore: "sfu" }],
    ["ospite con interruttore sfu", { interruttore: "sfu" }],
    ["ospite con segno", { segnoRipiego: true }],
  ]) {
    c(`${nome}: l'OSPITE NON DECIDE (parte in mesh, poi obbedisce)`, ["mesh", "ospite", false], sc({ ruolo: "ospite", ...x }));
  }
  c("la riga di app_config: sfu", "sfu", R.trasportoDaConfig('{"trasporto":"sfu"}'));
  c("…già letta come oggetto", "sfu", R.trasportoDaConfig({ trasporto: "sfu" }));
  c(
    "…assente, vuota, rotta o con altro valore: mesh",
    ["mesh", "mesh", "mesh", "mesh", "mesh"],
    [undefined, "", "{non json", '{"trasporto":"boh"}', { trasporto: 3 }].map((v) => R.trasportoDaConfig(v)),
  );

  /* ── COME I DUE LATI SI METTONO D'ACCORDO (§2.4 + N1 + N3) ───────────── */
  gruppo("MEETLY SFU · L'OSPITE ADOTTA IL TRASPORTO DEL CONSULENTE");
  const ad = (s, h, ctx = {}) => R.adottaTrasporto(s, h, { adesso: T0, nessunPcConnesso: true, ...ctx });
  const nuovo = R.nuovoStatoAdozione();
  c("all'inizio l'ospite è in mesh, senza consulente noto", ["mesh", null, false], [nuovo.trasporto, nuovo.hostPid, nuovo.ripiegoFatto]);
  const a1 = ad(nuovo, { pid: "host0001", tr: "sfu" });
  c("primo hello del consulente con tr:sfu: passa a SFU", ["sfu", "sfu"], [a1.azione, a1.stato.trasporto]);
  c("lo stato di prima non è stato toccato", "mesh", nuovo.trasporto);
  const a2 = ad(nuovo, { pid: "host0001" });
  c("hello senza tr: resta com'è (mesh)", ["resta", "mesh"], [a2.azione, a2.stato.trasporto]);
  const a3 = ad(a1.stato, { pid: "host0001", tr: "sfu" }, { adesso: T0 + 3000 });
  c("tr:sfu ripetuto ogni 3 s: niente da fare", "resta", a3.azione);
  const a4 = ad(a1.stato, { pid: "host0001" }, { adesso: T0 + 3000 });
  c("in SFU, consulente noto senza tr: resta com'è", ["resta", "sfu"], [a4.azione, a4.stato.trasporto]);
  const a5 = ad(a1.stato, { pid: "host0001", tr: "mesh" }, { adesso: T0 + 3000 });
  c("in SFU, il consulente dice tr:mesh (ha ripiegato): ripiego locale", ["mesh", "mesh", true], [a5.azione, a5.stato.trasporto, a5.stato.ripiegoFatto]);
  //  ⚠️ N1 — il ciclo sul ripiego: dopo un ripiego l'ospite NON torna in SFU, nemmeno se
  //   il consulente continua a mandare tr:sfu per qualche secondo e i pc mesh non sono ancora su.
  const dopoRipiego = R.dopoRipiegoLocale(a1.stato);
  c("dopoRipiegoLocale: mesh e ripiego fatto", ["mesh", true], [dopoRipiego.trasporto, dopoRipiego.ripiegoFatto]);
  const n1 = ad(dopoRipiego, { pid: "host0001", tr: "sfu" }, { adesso: T0 + 4000 });
  c("N1: tr:sfu dopo un ripiego locale è IGNORATO (un solo verso)", ["resta", "mesh", "gia-ripiegato"], [n1.azione, n1.stato.trasporto, n1.motivo]);
  c("N1: …anche a pc non connessi e dentro la finestra", "resta", ad(dopoRipiego, { pid: "host0001", tr: "sfu" }, { adesso: T0 + 1000, nessunPcConnesso: true }).azione);
  //  La riadozione mesh→SFU: solo nei primi secondi, solo con nessun pc connesso.
  const aperta = ad(nuovo, { pid: "host0001" }); // primo hello del consulente, senza tr (hello di presenza prima della decisione)
  c("l'hello di presenza prima della decisione non fa niente", "resta", aperta.azione);
  const tardi = (ms, ctx) => ad(aperta.stato, { pid: "host0001", tr: "sfu" }, { adesso: T0 + ms, ...ctx });
  c("tr:sfu dopo 3 s, nessun pc connesso: SFU", ["sfu", "sfu"], [tardi(3000).azione, tardi(3000).stato.trasporto]);
  c("tr:sfu allo scadere della finestra (10 s): ancora SFU", "sfu", tardi(R.FINESTRA_INGRESSO_MS).azione);
  c("tr:sfu fuori dalla finestra: mai", ["resta", "fuori-finestra"], [tardi(R.FINESTRA_INGRESSO_MS + 1).azione, tardi(R.FINESTRA_INGRESSO_MS + 1).motivo]);
  c("tr:sfu con un pc già connesso: si resta in mesh", ["resta", "pc-connesso"], [tardi(3000, { nessunPcConnesso: false }).azione, tardi(3000, { nessunPcConnesso: false }).motivo]);
  c("la finestra è di una decina di secondi", true, R.FINESTRA_INGRESSO_MS >= 8000 && R.FINESTRA_INGRESSO_MS <= 12000);
  //  Chi spaccia un hello da consulente: un pid diverso non basta a far ripiegare subito.
  const noto = a1.stato;
  const finto = ad(noto, { pid: "finto999", tr: "mesh" }, { adesso: T0 + 5000 });
  c("un altro pid che si dice consulente e manda tr:mesh: non fa ripiegare subito", ["resta", "sfu"], [finto.azione, finto.stato.trasporto]);
  //  N3 — il consulente che ricarica (nuovo pid) con l'ospite già in SFU.
  gruppo("MEETLY SFU · IL CONSULENTE RICARICA LA SCHEDA (N3)");
  const nuovoPid1 = ad(noto, { pid: "host0002" }, { adesso: T0 + 60_000 });
  c("nuovo pid del consulente, hello senza tr: l'ospite resta com'è", ["resta", "sfu", "host0002"], [nuovoPid1.azione, nuovoPid1.stato.trasporto, nuovoPid1.stato.hostPid]);
  const nuovoPid2 = ad(nuovoPid1.stato, { pid: "host0002" }, { adesso: T0 + 60_000 + 6000 });
  c("…dopo 6 s senza tr: ancora com'è", ["resta", "sfu"], [nuovoPid2.azione, nuovoPid2.stato.trasporto]);
  const nuovoPid3 = ad(nuovoPid2.stato, { pid: "host0002", tr: "sfu" }, { adesso: T0 + 60_000 + 7000 });
  c("…se arriva tr:sfu, nulla cambia (niente smontaggio della pubblicazione)", ["resta", "sfu"], [nuovoPid3.azione, nuovoPid3.stato.trasporto]);
  const nuovoPid4 = ad(nuovoPid3.stato, { pid: "host0002" }, { adesso: T0 + 60_000 + 30_000 });
  c("…e poi il consulente noto senza tr resta com'è", "resta", nuovoPid4.azione);
  const senzaTr = ad(nuovoPid2.stato, { pid: "host0002" }, { adesso: T0 + 60_000 + R.ATTESA_NUOVO_HOST_MS });
  c("nuovo pid mai con tr:sfu per 8 s (interruttore girato nel frattempo): passa a mesh", ["mesh", "mesh", true], [senzaTr.azione, senzaTr.stato.trasporto, senzaTr.stato.ripiegoFatto]);
  const meshEsplicito = ad(nuovoPid2.stato, { pid: "host0002", tr: "mesh" }, { adesso: T0 + 60_000 + R.ATTESA_NUOVO_HOST_MS });
  c("…lo stesso con tr:mesh esplicito, ma solo dopo gli 8 s", "mesh", meshEsplicito.azione);
  const subito = ad(noto, { pid: "host0002", tr: "mesh" }, { adesso: T0 + 60_000 });
  c("tr:mesh al primissimo hello del nuovo pid: ancora no (8 s)", "resta", subito.azione);
  const sfarfallio = ad(nuovoPid2.stato, { pid: "host0001", tr: "sfu" }, { adesso: T0 + 60_000 + 7000 });
  c("se rispunta il pid di prima con tr:sfu (hello in ritardo), torna lui il consulente", ["resta", "host0001"], [sfarfallio.azione, sfarfallio.stato.hostPid]);

  /* ── LA PERSONA C'È ANCORA? (§1.3, obiez. 3) ─────────────────────────── */
  gruppo("MEETLY SFU · STATO DEL PEER = «COLLEGATO ALLA PERSONA»");
  const sp = (x) =>
    R.statoPeer({ adesso: T0, chiuso: false, pub: "connected", sub: "connected", disconnessoDa: 0, tracce: true, ultimoSaluto: T0 - 1000, ...x });
  c("tutto a posto e salutato un secondo fa: connected", "connected", sp({}));
  c("chiuso: closed, qualunque cosa dicano i pc", "closed", sp({ chiuso: true, pub: "failed" }));
  c("pub fallita: failed", "failed", sp({ pub: "failed" }));
  c("sub fallita: failed", "failed", sp({ sub: "failed" }));
  c("pub in connessione: connecting", "connecting", sp({ pub: "connecting" }));
  c("sub ancora da aprire e pub in connessione: connecting", "connecting", sp({ pub: "connecting", sub: "new" }));
  c("tutti e due nuovi: new", "new", sp({ pub: "new", sub: "new" }));
  c("le tracce di quel pid non sono arrivate: connecting", "connecting", sp({ tracce: false }));
  c("mai salutato: non può essere connected", "connecting", sp({ ultimoSaluto: 0 }));
  c("un pc disconnected da 2 s: grazia, connecting", "connecting", sp({ sub: "disconnected", disconnessoDa: T0 - 2000 }));
  c("…da più della grazia: disconnected", "disconnected", sp({ sub: "disconnected", disconnessoDa: T0 - R.GRAZIA_PC_DISCONNESSO_MS - 1 }));
  c("…senza sapere da quando: disconnected (prudenza)", "disconnected", sp({ pub: "disconnected", disconnessoDa: 0 }));
  //  I limiti dei saluti: dodici secondi (4 saluti persi) e venticinque (8).
  c("12 s esatti di silenzio: ancora connected", "connected", sp({ ultimoSaluto: T0 - R.DISCONNESSO_DOPO_MS }));
  c("oltre i 12 s di silenzio: disconnected", "disconnected", sp({ ultimoSaluto: T0 - R.DISCONNESSO_DOPO_MS - 1 }));
  c("25 s esatti: ancora disconnected", "disconnected", sp({ ultimoSaluto: T0 - R.FALLITO_DOPO_MS }));
  c("oltre i 25 s: failed", "failed", sp({ ultimoSaluto: T0 - R.FALLITO_DOPO_MS - 1 }));
  c("le due soglie stanno sotto il taglio dall'elenco (30 s) e in ordine", true, R.DISCONNESSO_DOPO_MS < R.FALLITO_DOPO_MS && R.FALLITO_DOPO_MS < RIL.SALUTO_VIVO_MS);
  c("12 e 25 secondi, come deciso con il revisore", [12_000, 25_000], [R.DISCONNESSO_DOPO_MS, R.FALLITO_DOPO_MS]);
  //  ⚠️ Il caso vero: l'altro chiude la scheda senza «bye»; il pc verso Cloudflare resta
  //   sano, il flusso che il browser dà per vivo resta lì. Si segue il tempo con
  //   `verdettoSuOspite` del modulo vero (quello che decide chi resta nei riquadri).
  const ultimo = T0;
  const verdetto = (ms, extra = {}) => {
    const adesso = T0 + ms;
    const stato = extra.stato ?? sp({ adesso, ultimoSaluto: extra.ultimoSaluto ?? ultimo });
    return RIL.verdettoSuOspite({ adesso, ultimoSaluto: extra.ultimoSaluto ?? ultimo, stato, haMedia: true, primaVolta: T0 - 60_000 });
  };
  c("5 s dopo l'ultimo saluto: resta", "resta", verdetto(5000));
  c("13 s: disconnected, ma è ancora nei limiti: resta", ["disconnected", "resta"], [sp({ adesso: T0 + 13_000, ultimoSaluto: ultimo }), verdetto(13_000)]);
  c("21 s: il flusso sembrerebbe vivo ma la persona non c'è più: VIA", ["disconnected", "via"], [sp({ adesso: T0 + 21_000, ultimoSaluto: ultimo }), verdetto(21_000)]);
  c("26 s: failed → via", ["failed", "via"], [sp({ adesso: T0 + 26_000, ultimoSaluto: ultimo }), verdetto(26_000)]);
  c("31 s: via anche per il taglio dei 30 s", "via", verdetto(31_000));
  c("(controprova) con lo stato «connected» di un pc sano il riquadro resterebbe per sempre", "resta", verdetto(21_000, { stato: "connected" }));
  c("arriva un nuovo saluto a 22 s: a 23 s è di nuovo connected e resta", ["connected", "resta"], [
    sp({ adesso: T0 + 23_000, ultimoSaluto: T0 + 22_000 }),
    verdetto(23_000, { ultimoSaluto: T0 + 22_000 }),
  ]);

  /* ── RIPRESA: RICOSTRUIRE, RIABBONARE, RIPIEGARE (§1.7) ──────────────── */
  gruppo("MEETLY SFU · DECIDERE LA RIPRESA");
  const nuovaRip = () => R.nuovoStatoRipresa();
  const dec = (s, x) => R.decidiRipresa(s, { adesso: T0, tipo: "sub", ...x });
  const r1 = dec(nuovaRip(), { tipo: "sub" });
  c("un guasto del sub: ricostruisci il sub, conta se persiste", ["ricostruisci", "sub", true], [r1.azione, r1.quale, r1.contaSePersiste]);
  //  ⚠️ Un guasto, tre PeerSfu: tre richieste di fila = UNA ricostruzione.
  const r2 = dec(r1.stato, { tipo: "sub" });
  const r3 = dec(r2.stato, { tipo: "sub" });
  c("la 2ª e la 3ª richiesta dello stesso guasto si fondono: niente", ["niente", "niente", "in-volo"], [r2.azione, r3.azione, r3.motivo]);
  c("…ma un guasto del pub è un altro guasto", "ricostruisci", dec(r1.stato, { tipo: "pub" }).azione);
  const s0 = nuovaRip();
  dec(s0, { tipo: "sub" });
  c("la decisione non modifica lo stato che le si dà", false, s0.inVolo.sub);
  //  Il budget: 3 in 5 minuti, solo quelle COMPLETATE che non hanno risolto.
  const fine = (s, tipo, ms, persistito) => R.finisciRicostruzione(s, tipo, T0 + ms, persistito);
  let b = nuovaRip();
  for (const [ms] of [[0], [60_000], [120_000]]) {
    const d = R.decidiRipresa(b, { adesso: T0 + ms, tipo: "sub" });
    b = fine(d.stato, "sub", ms + 5000, true);
  }
  c("tre ricostruzioni completate con guasto persistito in 5 minuti: ora si ripiega", ["ripiega", "ice-fallita"], [
    R.decidiRipresa(b, { adesso: T0 + 130_000, tipo: "sub" }).azione,
    R.decidiRipresa(b, { adesso: T0 + 130_000, tipo: "sub" }).motivo,
  ]);
  c("…e vale anche per il pub", "ripiega", R.decidiRipresa(b, { adesso: T0 + 130_000, tipo: "pub" }).azione);
  c("passati i 5 minuti dalla prima, il conto si libera", "ricostruisci", R.decidiRipresa(b, { adesso: T0 + R.FINESTRA_RICOSTRUZIONI_MS + 5001, tipo: "sub" }).azione);
  let b2 = nuovaRip();
  for (const ms of [0, 60_000, 120_000]) {
    const d = R.decidiRipresa(b2, { adesso: T0 + ms, tipo: "sub" });
    b2 = fine(d.stato, "sub", ms + 5000, false);
  }
  c("tre ricostruzioni RIUSCITE (guasto risolto) non consumano il budget", "ricostruisci", R.decidiRipresa(b2, { adesso: T0 + 130_000, tipo: "sub" }).azione);
  c("finita la ricostruzione, il guasto non è più «in volo»", false, b2.inVolo.sub);
  c("il budget è di 3 in 5 minuti", [3, 300_000], [R.RICOSTRUZIONI_MAX, R.FINESTRA_RICOSTRUZIONI_MS]);
  //  Pid muto con pc sani: si riabbona soltanto.
  const m1 = dec(nuovaRip(), { tipo: "pid-muto", pid: "ospite01", pidHaSalutato: true });
  c("pid muto con pc sani: riabbona quel pid", ["riabbona", "ospite01"], [m1.azione, m1.pid]);
  const m2 = dec(m1.stato, { tipo: "pid-muto", pid: "ospite01", pidHaSalutato: true, adesso: T0 + 1000 });
  c("…la seconda volta nel minuto ancora", "riabbona", m2.azione);
  const m3 = dec(m2.stato, { tipo: "pid-muto", pid: "ospite01", pidHaSalutato: true, adesso: T0 + 2000 });
  c("…la terza nel minuto no (massimo 2 al minuto)", ["niente", "limite-riabbona"], [m3.azione, m3.motivo]);
  c("…ma un altro pid sì", "riabbona", dec(m3.stato, { tipo: "pid-muto", pid: "ospite02", pidHaSalutato: true, adesso: T0 + 2000 }).azione);
  c("…e passato il minuto riparte", "riabbona", dec(m3.stato, { tipo: "pid-muto", pid: "ospite01", pidHaSalutato: true, adesso: T0 + 61_000 }).azione);
  let muti = nuovaRip();
  const esiti = [];
  for (let i = 0; i < 20; i++) {
    const d = R.decidiRipresa(muti, { adesso: T0 + i * 3000, tipo: "pid-muto", pid: "ospite01", pidHaSalutato: true });
    muti = d.stato;
    esiti.push(d.azione);
  }
  c("un pid muto per un minuto: mai ripiego, mai ricostruzione", false, esiti.some((e) => e === "ripiega" || e === "ricostruisci"));
  c("pid che non saluta più: niente (la persona se n'è andata)", ["niente", "senza-saluto"], [
    dec(nuovaRip(), { tipo: "pid-muto", pid: "ospite01", pidHaSalutato: false }).azione,
    dec(nuovaRip(), { tipo: "pid-muto", pid: "ospite01", pidHaSalutato: false }).motivo,
  ]);
  //  Ripubblicare perché è arrivato un tipo di traccia che mancava.
  const t1 = dec(b, { tipo: "tipo-arrivato" });
  c("camera concessa dopo l'ingresso: si ripubblica anche a budget esaurito, senza contarla", ["ricostruisci", "pub", false], [t1.azione, t1.quale, t1.contaSePersiste]);
  c("…ma una sola alla volta", "niente", dec(t1.stato, { tipo: "tipo-arrivato" }).azione);
  c("…e il suo completamento, anche con guasto persistito, non entra nel budget", b.ricostruzioni.length, R.finisciRicostruzione(t1.stato, "pub", T0 + 3000, true).ricostruzioni.length);
  //  M-line morte del sub.
  c("12 m-line morte: ancora niente", "niente", dec(nuovaRip(), { tipo: "mline-morte", mlineMorte: 12 }).azione);
  const ml = dec(b, { tipo: "mline-morte", mlineMorte: 13 });
  c("13 m-line morte: ricostruzione dolce del solo sub, fuori dal budget", ["ricostruisci", "sub", false], [ml.azione, ml.quale, ml.contaSePersiste]);
  c("…non c'è ripiego anche a budget esaurito", "ricostruisci", ml.azione);
  c("la soglia è 12", 12, R.MLINE_MORTE_MAX);
  c("riabbona al massimo 2 al minuto", [2, 60_000], [R.RIABBONA_MAX, R.FINESTRA_RIABBONA_MS]);

  /* ── CHI PUÒ ABBONARSI A COSA (§1.5) ─────────────────────────────────── */
  gruppo("MEETLY SFU · ABBONARSI SOLO ALLE TRACCE DI UNA PERSONA DELLA STANZA");
  const righe = [
    { pid: "ospite01", at: T0 - 1000, pubSessionId: "sess-ospite01", audio: "ospite01-a", video: "ospite01-v" },
    { pid: "host0001", at: T0 - 2000, pubSessionId: "sess-host0001", audio: "host0001-a", video: "" },
    { pid: "morto001", at: T0 - R.RIGA_VIVA_MS - 1, pubSessionId: "sess-morto001", audio: "morto001-a", video: "morto001-v" },
  ];
  const pa = (tracce, pid = "host0001", extra = {}) => R.puoAbbonarsi({ adesso: T0, pid, righe, tracce, ...extra });
  c("la traccia audio di un altro della stanza: sì", { ok: true }, pa([{ sessionId: "sess-ospite01", trackName: "ospite01-a" }]));
  c("audio e video insieme: sì", true, pa([{ sessionId: "sess-ospite01", trackName: "ospite01-a" }, { sessionId: "sess-ospite01", trackName: "ospite01-v" }]).ok);
  c("una sessione di un'altra stanza (non in questa): no", [false, "sessione"], (({ ok, motivo }) => [ok, motivo])(pa([{ sessionId: "sess-altra", trackName: "ospite01-a" }])));
  c("la propria sessione/traccia: no", [false, "propria"], (({ ok, motivo }) => [ok, motivo])(pa([{ sessionId: "sess-host0001", trackName: "host0001-a" }])));
  c("la sessione di uno con il nome della traccia di un altro: no", false, pa([{ sessionId: "sess-ospite01", trackName: "host0001-a" }]).ok);
  c("nome fuori formato: no", [false, "nome"], (({ ok, motivo }) => [ok, motivo])(pa([{ sessionId: "sess-ospite01", trackName: "ospite01-x" }])));
  c("nome con maiuscole o trattini extra: no", [false, false], [pa([{ sessionId: "sess-ospite01", trackName: "OSPITE01-a" }]).ok, pa([{ sessionId: "sess-ospite01", trackName: "ospite01-a-a" }]).ok]);
  c("una traccia che quella riga non ha pubblicato (video vuoto): no", [false, "traccia"], (({ ok, motivo }) => [ok, motivo])(
    R.puoAbbonarsi({ adesso: T0, pid: "ospite01", righe, tracce: [{ sessionId: "sess-host0001", trackName: "host0001-v" }] }),
  ));
  c("riga non più viva (3 minuti senza azioni): no", [false, "non-viva"], (({ ok, motivo }) => [ok, motivo])(pa([{ sessionId: "sess-morto001", trackName: "morto001-a" }])));
  c("la riga viva scade proprio a 3 minuti", 180_000, R.RIGA_VIVA_MS);
  c("nessuna traccia: no", false, pa([]).ok);
  const nove = Array.from({ length: 9 }, () => ({ sessionId: "sess-ospite01", trackName: "ospite01-a" }));
  c("più di 8 tracce in una chiamata: no", [false, "troppe"], (({ ok, motivo }) => [ok, motivo])(pa(nove)));
  c("otto: sì", true, pa(nove.slice(0, 8)).ok);
  c("una sola traccia cattiva rovina tutta la richiesta", false, pa([{ sessionId: "sess-ospite01", trackName: "ospite01-a" }, { sessionId: "sess-altra", trackName: "ospite01-v" }]).ok);
  c("tracce non è un elenco: no, senza lanciare", false, pa(undefined).ok);
  c("righeVive: solo quelle con azione negli ultimi 3 minuti", ["ospite01", "host0001"], R.righeVive(righe, T0).map((r) => r.pid));

  /* ── RAPPORTO UNITO (getStats del PeerSfu) ───────────────────────────── */
  gruppo("MEETLY SFU · IL RAPPORTO getStats UNITO");
  //  Due partecipanti da cui si riceve (mid 1 e 2) e un pub. Gli id dei due pc si somigliano
  //  di proposito (CP1, LC1): è per questo che vanno prefissati.
  const rapporto = (voci) => new Map(voci.map((v) => [v.id, v]));
  const pubStats = () =>
    rapporto([
      { id: "OT1", type: "outbound-rtp", kind: "video", bytesSent: 5000, transportId: "T1", qualityLimitationReason: "none" },
      { id: "RI1", type: "remote-inbound-rtp", kind: "video", fractionLost: 0.02, roundTripTime: 0.05 },
      { id: "CP1", type: "candidate-pair", nominated: true, state: "succeeded", bytesSent: 6000, bytesReceived: 300, availableOutgoingBitrate: 1_000_000, currentRoundTripTime: 0.04, localCandidateId: "LC1", remoteCandidateId: "RC1", transportId: "T1" },
      { id: "LC1", type: "local-candidate", candidateType: "relay" },
      { id: "RC1", type: "remote-candidate", candidateType: "host" },
    ]);
  const subStats = () =>
    rapporto([
      { id: "IN1", type: "inbound-rtp", kind: "video", mid: "1", bytesReceived: 100_000, packetsReceived: 90, packetsLost: 1 },
      { id: "IN2", type: "inbound-rtp", kind: "video", mid: "2", bytesReceived: 200_000, packetsReceived: 190, packetsLost: 2 },
      { id: "CP1", type: "candidate-pair", nominated: true, state: "succeeded", bytesSent: 400, bytesReceived: 310_000, localCandidateId: "LC1", remoteCandidateId: "RC1", transportId: "T1" },
      { id: "LC1", type: "local-candidate", candidateType: "srflx" },
    ]);
  const mia = (mid) => (v) => v.mid === mid;
  const unito = (capofila, mid) => R.unisciRapporti({ capofila, pub: pubStats(), sub: subStats(), eMia: mia(mid) });
  const lista = (rep) => {
    const out = [];
    rep.forEach((v, id) => out.push([id, v]));
    return out;
  };
  //  La lettura di `sampleUsage`, copiata nelle sue regole (call.tsx): coppia se c'è, altrimenti RTP.
  const consumo = (rep) => {
    let pairSent = 0, pairRecv = 0, rtpSent = 0, rtpRecv = 0;
    rep.forEach((r) => {
      if (r.type === "candidate-pair" && (r.nominated || r.state === "succeeded")) {
        pairSent += Number(r.bytesSent) || 0;
        pairRecv += Number(r.bytesReceived) || 0;
      } else if (r.type === "outbound-rtp" && !r.isRemote) rtpSent += Number(r.bytesSent) || 0;
      else if (r.type === "inbound-rtp" && !r.isRemote) rtpRecv += Number(r.bytesReceived) || 0;
    });
    return { sent: pairSent || rtpSent, recv: pairRecv || rtpRecv };
  };
  const totale = (capofilaA) => {
    const a = consumo(unito(capofilaA, "1"));
    const b = consumo(unito(!capofilaA, "2"));
    return { sent: a.sent + b.sent, recv: a.recv + b.recv };
  };
  c("CONSUMI: stesso totale con capofila A e con capofila B", totale(true), totale(false));
  c("CONSUMI: ricevuto = i soli inbound-rtp dei due, una volta sola (nessun doppio conteggio)", 300_000, totale(true).recv);
  c("CONSUMI: inviato = quello che dicono le coppie (pub 6000 + sub 400)", 6400, totale(true).sent);
  const A = unito(true, "1");
  const B = unito(false, "2");
  c("il capofila vede l'uscita: outbound-rtp e remote-inbound-rtp del pub", [true, true], [
    lista(A).some(([, v]) => v.type === "outbound-rtp"),
    lista(A).some(([, v]) => v.type === "remote-inbound-rtp"),
  ]);
  c("il capofila vede degli inbound-rtp SOLO quelli della sua traccia", ["1"], lista(A).filter(([, v]) => v.type === "inbound-rtp").map(([, v]) => v.mid));
  c("il non-capofila ha SOLO gli inbound-rtp delle sue tracce", [["inbound-rtp"], ["2"]], [
    [...new Set(lista(B).map(([, v]) => v.type))],
    lista(B).map(([, v]) => v.mid),
  ]);
  c("gli id sono prefissati: pub: e sub:", true, lista(A).every(([id]) => /^(pub|sub):/.test(id)));
  c("il campo id dentro la voce è lo stesso della chiave", true, lista(A).every(([id, v]) => v.id === id));
  c("i due CP1 non si schiacciano", true, A.has("pub:CP1") && A.has("sub:CP1") && A.get("pub:CP1") !== A.get("sub:CP1"));
  const cpPub = A.get("pub:CP1");
  c("localCandidateId riscritto e risolvibile (il relay del pub)", ["pub:LC1", "relay"], [cpPub.localCandidateId, A.get(cpPub.localCandidateId)?.candidateType]);
  c("…i riferimenti del sub puntano al suo candidato, non a quello del pub", ["sub:LC1", "srflx"], [A.get("sub:CP1").localCandidateId, A.get(A.get("sub:CP1").localCandidateId)?.candidateType]);
  c("remoteCandidateId e transportId seguono la stessa regola", ["pub:RC1", "pub:T1"], [cpPub.remoteCandidateId, cpPub.transportId]);
  c("la banda, il giro e i byte inviati del pub restano (servono a S.linea)", [1_000_000, 0.04, 6000], [cpPub.availableOutgoingBitrate, cpPub.currentRoundTripTime, cpPub.bytesSent]);
  c("i byte RICEVUTI della coppia sono azzerati (STUN e RTCP non sono media)", [0, 0], [cpPub.bytesReceived, A.get("sub:CP1").bytesReceived]);
  const intatto = pubStats().get("CP1");
  c("i rapporti di partenza non vengono modificati", [300, "LC1"], [intatto.bytesReceived, intatto.localCandidateId]);
  const nonCap = unisciSenzaPub();
  function unisciSenzaPub() {
    return R.unisciRapporti({ capofila: true, pub: null, sub: subStats(), eMia: mia("1") });
  }
  c("senza pub (non ancora nato): c'è comunque quello che si ha", true, nonCap.size > 0 && !lista(nonCap).some(([, v]) => v.type === "outbound-rtp"));
  c("senza niente: un rapporto vuoto, non un errore", 0, R.unisciRapporti({ capofila: true, pub: null, sub: null, eMia: mia("1") }).size);
  let prima = "";
  A.forEach((v, id) => (prima ||= id));
  c("forEach(valore, id) come RTCStatsReport", "string", typeof prima);

  /* ── TETTO E COSTANTI (§1.7 obiez. 8, §1.5 limiti) ───────────────────── */
  gruppo("MEETLY SFU · TETTO PRUDENTE E LIMITI");
  const callTsx = leggi("src/shop/call.tsx");
  const medBr = Number(/med:\s*\{[^}]*\bbr:\s*([\d_]+)/.exec(callTsx)?.[1].replace(/_/g, ""));
  c("tettoSfu() = bitrate di «med» in call.tsx (non si allontanano)", medBr, R.tettoSfu());
  c("…ed è 1,4 Mbit", 1_400_000, R.tettoSfu());
  c("i limiti della rotta (§1.5)", [96 * 1024, 8, 6, 600_000, 40, 3_600_000, 8, 30], [
    R.MAX_CORPO_BYTE, R.MAX_RIGHE_VIVE, R.MAX_PUBBLICA_PID, R.FINESTRA_PUBBLICA_PID_MS, R.MAX_PUBBLICA_CODICE, R.FINESTRA_PUBBLICA_CODICE_MS, R.MAX_TRACCE_ABBONATI, R.MAX_ABBONATI_MINUTO,
  ]);
  c("il battito della riga: ogni minuto, con 3 minuti di margine", [60_000, 180_000], [R.RINNOVA_OGNI_MS, R.RIGA_VIVA_MS]);
  c("i tempi del ripiego (§2.5): 8 s al server, 12 s per il pub, 15 s per il sub", [8000, 12_000, 15_000], [R.TIMEOUT_SERVER_MS, R.TIMEOUT_PUB_MS, R.TIMEOUT_SUB_MS]);
  c("l'ospite ritenta ~20 s su 403 non-ammesso / 409 / 429 (N2), ogni 1-2 s", [20_000, 1500], [R.ATTESA_OSPITE_MS, R.RITENTA_OGNI_MS]);
  c("lettura dell'interruttore: 1,5 s", 1500, R.LETTURA_INTERRUTTORE_MS);

  /* ── IL FILE STESSO ──────────────────────────────────────────────────── */
  gruppo("MEETLY SFU · IL MODULO È PURO");
  const sorgente = senzaCommenti(leggi("src/shop/meetly-sfu-regole.ts"));
  c("niente window, document, fetch, console, process né segreti", [false, false, false, false, false, false], [
    /\bwindow\b/.test(sorgente),
    /\bdocument\b/.test(sorgente),
    /\bfetch\s*\(/.test(sorgente),
    /\bconsole\./.test(sorgente),
    /\bprocess\b/.test(sorgente),
    /MEETLY_SFU_APP|appSecret|Authorization/.test(sorgente),
  ]);
  c("non usa Math.random né Date.now (l'orologio arriva da fuori)", [false, false], [/Math\.random/.test(sorgente), /Date\.now/.test(sorgente)]);
}
