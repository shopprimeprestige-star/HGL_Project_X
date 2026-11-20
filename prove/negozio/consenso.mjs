/** ── SHOP R1 · T23 · IL CONSENSO (MODULO PURO) ───────────────────────────────────
 *  `src/lib/consenso.ts`: legge e scrive la scelta dei cookie. Tutte le combinazioni: nessuna scelta,
 *  la scelta vecchia (v1), la nuova (v2), i valori rotti, il browser che non lascia scrivere.
 *  Qui non gira un browser: lo «storage» è un finto con `getItem/setItem`. Dati: nessuno. */

/** Un finto localStorage; `lancia` fa fallire la lettura e/o la scrittura come un browser con i cookie bloccati. */
const memoria = (iniziale = {}, { leggi = true, scrivi = true } = {}) => {
  const d = { ...iniziale };
  return {
    d,
    getItem(k) {
      if (!leggi) throw new Error("storage bloccato");
      return k in d ? d[k] : null;
    },
    setItem(k, v) {
      if (!scrivi) throw new Error("storage bloccato");
      d[k] = String(v);
    },
  };
};
const v2 = (o) => JSON.stringify({ v: 2, ts: 1000, ...o });

export async function prove(mod, { c, gruppo }) {
  const K = mod["lib/consenso"];
  gruppo("SHOP R1 · T23 · IL CONSENSO (20/11/2026)");
  c("il modulo c'è e dà le chiavi e le funzioni del contratto (PIANO §3.4)", [true, true, true, true, true, true],
    [typeof K?.leggiConsenso === "function", typeof K?.scriviConsenso === "function", typeof K?.puoCaricare === "function", typeof K?.modoGoogle === "function", K?.CHIAVE_V1 === "hgl_cookie_consent_v1", K?.CHIAVE_V2 === "hgl_cookie_consent_v2"]);
  if (!K?.leggiConsenso) return;
  const { leggiConsenso: leggi, scriviConsenso: scrivi, puoCaricare: puo, modoGoogle: google, CHIAVE_V1, CHIAVE_V2 } = K;
  const NIENTE = { scelto: false, statistiche: false, marketing: false };
  const forma = (x) => ({ scelto: x.scelto, statistiche: x.statistiche, marketing: x.marketing });
  const tre = (x) => [puo("meta", x), puo("tiktok", x), puo("google", x)];

  /* ── la lettura: tutte le combinazioni ── */
  const casi = [
    ["nessuna scelta", {}, { ...NIENTE }, [false, false, false]],
    ["v1 «reject»: il rifiuto di prima resta valido", { [CHIAVE_V1]: "reject" }, { scelto: true, statistiche: false, marketing: false }, [false, false, false]],
    ["v1 «accept»: il vecchio «Accetta» non nomina Meta/TikTok/Google, si ripropone", { [CHIAVE_V1]: "accept" }, { ...NIENTE }, [false, false, false]],
    ["v2 solo necessari", { [CHIAVE_V2]: v2({ statistiche: false, marketing: false }) }, { scelto: true, statistiche: false, marketing: false }, [false, false, false]],
    ["v2 solo statistiche: Google sì, Meta e TikTok no", { [CHIAVE_V2]: v2({ statistiche: true, marketing: false }) }, { scelto: true, statistiche: true, marketing: false }, [false, false, true]],
    ["v2 solo marketing: tutti e tre", { [CHIAVE_V2]: v2({ statistiche: false, marketing: true }) }, { scelto: true, statistiche: false, marketing: true }, [true, true, true]],
    ["v2 statistiche e marketing", { [CHIAVE_V2]: v2({ statistiche: true, marketing: true }) }, { scelto: true, statistiche: true, marketing: true }, [true, true, true]],
    ["v2 vince su v1 «accept» (chi ha poi scelto solo i necessari)", { [CHIAVE_V1]: "accept", [CHIAVE_V2]: v2({ statistiche: false, marketing: false }) }, { scelto: true, statistiche: false, marketing: false }, [false, false, false]],
    ["v2 vince su v1 «reject» (chi ha poi accettato)", { [CHIAVE_V1]: "reject", [CHIAVE_V2]: v2({ statistiche: true, marketing: true }) }, { scelto: true, statistiche: true, marketing: true }, [true, true, true]],
    ["JSON rotto in v2: non scelto", { [CHIAVE_V2]: "{non è json" }, { ...NIENTE }, [false, false, false]],
    ["JSON rotto in v2 e v1 «accept»: non scelto", { [CHIAVE_V2]: "{", [CHIAVE_V1]: "accept" }, { ...NIENTE }, [false, false, false]],
    ["v2 con valori strani (stringhe al posto dei booleani): non scelto", { [CHIAVE_V2]: v2({ statistiche: "true", marketing: "true" }) }, { ...NIENTE }, [false, false, false]],
    ["v2 con 1 al posto di true: non scelto", { [CHIAVE_V2]: v2({ statistiche: 1, marketing: 1 }) }, { ...NIENTE }, [false, false, false]],
    ["v2 con versione sbagliata: non scelto", { [CHIAVE_V2]: JSON.stringify({ v: 3, statistiche: true, marketing: true, ts: 1 }) }, { ...NIENTE }, [false, false, false]],
    ["v2 che non è un oggetto (null, numero, lista): non scelto", { [CHIAVE_V2]: "null" }, { ...NIENTE }, [false, false, false]],
    ["v2 che è una lista: non scelto", { [CHIAVE_V2]: "[true,true]" }, { ...NIENTE }, [false, false, false]],
    ["v2 vuoto: non scelto", { [CHIAVE_V2]: "" }, { ...NIENTE }, [false, false, false]],
    ["v1 con un valore strano: non scelto", { [CHIAVE_V1]: "forse" }, { ...NIENTE }, [false, false, false]],
    ["v1 «ACCEPT» in maiuscolo: non è «accept», non scelto, e niente marketing", { [CHIAVE_V1]: "ACCEPT" }, { ...NIENTE }, [false, false, false]],
  ];
  for (const [nome, dati, atteso, piattaforme] of casi) {
    const r = leggi(memoria(dati));
    c(`${nome} → consenso`, atteso, forma(r));
    c(`${nome} → puoCaricare(meta, tiktok, google)`, piattaforme, tre(r));
  }
  c("v2 valido porta l'ora della scelta", 1000, leggi(memoria({ [CHIAVE_V2]: v2({ statistiche: true, marketing: true }) })).ts);
  c("v2 senza ora valida: ts vale 0, la scelta resta valida", [0, true], (() => { const r = leggi(memoria({ [CHIAVE_V2]: JSON.stringify({ v: 2, statistiche: true, marketing: false, ts: "ieri" }) })); return [r.ts, r.scelto]; })());
  c("la scelta v1 è marcata «legacy»; la v2 no", [true, true, false], [leggi(memoria({ [CHIAVE_V1]: "reject" })).legacy === true, leggi(memoria({ [CHIAVE_V1]: "accept" })).legacy === true, leggi(memoria({ [CHIAVE_V2]: v2({ statistiche: true, marketing: true }) })).legacy === true]);
  c("senza alcuna scelta `legacy` non c'è", false, "legacy" in leggi(memoria({})) && leggi(memoria({})).legacy === true);

  /* ── lo storage che non c'è o che lancia ── */
  for (const [nome, st] of [["storage che lancia in lettura", memoria({}, { leggi: false })], ["storage nullo", null], ["storage indefinito", undefined], ["storage senza metodi", {}]]) {
    let r, errore = null;
    try { r = leggi(st); } catch (e) { errore = String(e); }
    c(`${nome}: non lancia e vale «non scelto»`, [null, { ...NIENTE }, [false, false, false]], [errore, r && forma(r), r && tre(r)]);
  }

  /* ── la scrittura ── */
  const st = memoria({ [CHIAVE_V1]: "accept" });
  const scritto = scrivi(st, { statistiche: true, marketing: false }, 5000);
  c("scriviConsenso scrive v2 e restituisce la scelta letta", [{ scelto: true, statistiche: true, marketing: false }, 5000], [forma(scritto), scritto.ts]);
  c("scriviConsenso NON cancella la chiave v1 (la scelta vecchia resta com'era)", "accept", st.d[CHIAVE_V1]);
  c("rileggendo si ottiene la stessa scelta", { scelto: true, statistiche: true, marketing: false }, forma(leggi(st)));
  c("la scelta v2 è un JSON con versione, i due booleani e l'ora", { v: 2, statistiche: true, marketing: false, ts: 5000 }, JSON.parse(st.d[CHIAVE_V2]));
  const st2 = memoria({});
  scrivi(st2, { statistiche: "sì", marketing: 1 }, 7000);
  c("valori non booleani in ingresso valgono «no» (mai «sì» per sbaglio)", { statistiche: false, marketing: false }, (({ statistiche, marketing }) => ({ statistiche, marketing }))(JSON.parse(st2.d[CHIAVE_V2])));
  scrivi(st2, { statistiche: false, marketing: false }, 8000);
  c("la revoca (tutto falso) sovrascrive la scelta di prima", [{ scelto: true, statistiche: false, marketing: false }, [false, false, false]], [forma(leggi(st2)), tre(leggi(st2))]);

  const bloccato = memoria({}, { scrivi: false });
  let r2, err2 = null;
  try { r2 = scrivi(bloccato, { statistiche: true, marketing: true }, 1); } catch (e) { err2 = String(e); }
  c("con lo storage che non lascia scrivere: non lancia, vale «non scelto», nessun marketing", [null, { ...NIENTE }, [false, false, false]], [err2, r2 && forma(r2), r2 && tre(r2)]);
  let err3 = null;
  try { scrivi(null, { statistiche: true, marketing: true }, 1); } catch (e) { err3 = String(e); }
  c("scriviConsenso con storage nullo non lancia", null, err3);

  /* ── l'evento `hgl:consenso` ── */
  const arrivati = [];
  const prima = globalThis.window;
  globalThis.window = { dispatchEvent: (e) => { arrivati.push([e.type, e.detail && forma(e.detail)]); return true; } };
  try {
    scrivi(memoria({}), { statistiche: true, marketing: true }, 9000);
    scrivi(memoria({}, { scrivi: false }), { statistiche: true, marketing: true }, 9000);
  } finally {
    if (prima === undefined) delete globalThis.window; else globalThis.window = prima;
  }
  c("scrivere avvisa la pagina con `hgl:consenso` e la scelta; se la scrittura fallisce l'evento porta «non scelto»",
    [["hgl:consenso", { scelto: true, statistiche: true, marketing: true }], ["hgl:consenso", { ...NIENTE }]], arrivati);
  c("senza `window` (server) scrivere non lancia", null, (() => { try { scrivi(memoria({}), { statistiche: true, marketing: true }, 1); return null; } catch (e) { return String(e); } })());

  /* ── puoCaricare: piattaforma sconosciuta, consenso rotto ── */
  const tutto = { scelto: true, statistiche: true, marketing: true, ts: 1 };
  c("puoCaricare con una piattaforma sconosciuta: no, anche con tutto concesso", [false, false, false], [puo("pinterest", tutto), puo("", tutto), puo(undefined, tutto)]);
  c("puoCaricare con consenso mancante o non scelto ma con i flag veri: no (serve `scelto`)", [false, false, false], [puo("meta", null), puo("meta", undefined), puo("google", { scelto: false, statistiche: true, marketing: true, ts: 0 })]);

  /* ── Google Consent Mode: solo «granted» / «denied» esatti ── */
  const modi = [
    ["nessuna scelta", NIENTE, { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" }],
    ["solo statistiche", { scelto: true, statistiche: true, marketing: false }, { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" }],
    ["solo marketing", { scelto: true, statistiche: false, marketing: true }, { analytics_storage: "denied", ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" }],
    ["statistiche e marketing", { scelto: true, statistiche: true, marketing: true }, { analytics_storage: "granted", ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" }],
    ["flag veri ma non scelto (valore incoerente)", { scelto: false, statistiche: true, marketing: true }, { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" }],
  ];
  for (const [nome, cons, atteso] of modi) c(`modoGoogle · ${nome}`, atteso, google({ ts: 0, ...cons }));
  const valori = new Set([...Object.values(google(tutto)), ...Object.values(google(NIENTE))]);
  c("modoGoogle usa solo i due valori «granted» e «denied»", ["denied", "granted"], [...valori].sort());
  c("modoGoogle con consenso nullo: tutto «denied», non lancia", ["denied"], [...new Set(Object.values(google(null)))]);
}
