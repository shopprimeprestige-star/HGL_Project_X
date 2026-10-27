/** ── PROVE: LA CONCORRENZA DELLA PRENOTAZIONE IN CHAT (T9) ────────────────────
 *
 *  Commessa 2026-10-27 (prenota in chat), PIANO.md T9 e D3, SPEC 9.4 e 10.1
 *  («prova obbligatoria con due richieste insieme»). Le prove di `prenota.mjs`
 *  fanno una richiesta alla volta e mettono la setter "a metà" con un gancio.
 *  Qui invece girano DAVVERO più `gestisciPrenota` insieme, e si guarda cosa
 *  succede in ogni ordine in cui le loro chiamate al database possono
 *  incrociarsi.
 *
 *  ── Come si intrecciano ──────────────────────────────────────────────────
 *  Ogni richiesta (un «attore») riceve porte che, a OGNI chiamata, si
 *  fermano e aspettano il via della REGIA. La regia sceglie quale chiamata
 *  lasciar partire (il mondo finto di T7 le esegue poi in un colpo solo, come
 *  una query) e aspetta che tutti siano di nuovo fermi: nessun timer, nessun
 *  caso. Anche «la setter che salva dal browser» e «l'orologio che salta di 21
 *  secondi» sono attori da una sola mossa, che la regia mette dove vuole.
 *  Tre modi di scegliere:
 *   · SISTEMATICO: tutte le sequenze con al massimo K cambi di attore in
 *     mezzo (K=1 e K=2; i bug di concorrenza stanno quasi sempre lì);
 *   · A SEME: sequenze a caso ma riproducibili (stesso seme, stessa
 *     sequenza), con più o meno «insistenza» sullo stesso attore;
 *   · GUIDATO: si porta un attore fino a un punto preciso (es. «ha scritto la
 *     scheda e non ha ancora riletto l'agenda»), poi si lascia agire un
 *     altro, poi si esplora tutto il resto.
 *
 *  ── Cosa si controlla, a OGNI sequenza (`invarianti`) ─────────────────────
 *   1. tutti finiscono, senza eccezioni e senza avvisi di errore;
 *   2. per ogni consulente e giorno, nessuna sovrapposizione fra schede vive
 *      (`tieneLoSlot`): mai due prenotazioni sullo stesso orario;
 *   3. nessun lucchetto rimasto (salvo quelli messi dalla prova);
 *   4. nessuna riga stanza orfana (meet / fascia / attesi di una prenotazione
 *      che non esiste) e nessuna prenotazione senza stanza;
 *   5. ogni risposta è coerente con la scheda: «Fatto» solo se la prenotazione
 *      c'è col suo link; «preso» solo se la scheda è identica a prima;
 *   6. nessun dato di un altro cliente nelle risposte.
 *  E ogni scenario ha le sue attese (chi può vincere, che codice può uscire).
 *  Per non fare prove vuote ogni scenario dichiara anche COSA DEVE ESSERE
 *  SUCCESSO ALMENO UNA VOLTA nelle sequenze provate (copertura).
 *
 *  ── Difetti trovati e limiti dichiarati ─────────────────────────────────
 *  Questo file non corregge il codice. I due difetti che ha trovato sono stati
 *  poi corretti (commit d9acae7):
 *   · D1 (dopo «preso» riproponeva lo stesso orario): ora è un controllo
 *     NORMALE in ogni scenario; se ricompare, rosso.
 *   · D2 (con un lucchetto scaduto a metà, il disfare tocca la riga «fascia»
 *     dell'altra prenotazione): corretto per ciò che si poteva senza una
 *     scrittura condizionata nella porta. Resta un LIMITE DICHIARATO (decisione
 *     del capo progetto): due richieste che scrivono insieme con il lucchetto
 *     scaduto lasciano una fascia che punta a una stanza tolta (a) oppure
 *     senza la riga fascia di chi è rimasto prenotato (b). Succede solo se un
 *     lucchetto da 20 s scade mentre la richiesta lavora (e ogni richiesta si
 *     ferma prima di scrivere dopo 8 s); prenotazioni e schede restano giuste,
 *     il danno possibile è solo che, se la setter aggiunge a mano un'altra
 *     persona in quell'ora, ha un altro link. Il controllo resta visibile
 *     nell'uscita come «LIMITE DICHIARATO» e non è mai rosso, nemmeno con
 *     `T9_STRICT=1`. Si chiude con una porta a scrittura condizionata per la
 *     riga fascia, o con un campo «chi l'ha scritta» nella riga.
 *
 *  Le date: martedì 27/10/2026, 14:00 a Roma. I consulenti lavorano lunedì-
 *  venerdì, 09-13 e 14-19. «Sera» = i primi tre orari sono mar 27, mer 28 e gio
 *  29 alle 17:00; «Opzione 2» = mer 28/10 alle 17:00 (lo SLOT di tutte le
 *  prove). Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { deepStrictEqual } from "node:assert";
import {
  ADESSO,
  BEA,
  FIL,
  ID,
  SENSIBILI,
  consulente,
  consulenza,
  corpoScelta,
  corpoTesto,
  creaMondo,
  lead,
} from "./prenota-mondo.mjs";

const identiche = (a, b) => {
  try {
    deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
};

/** Lo slot di tutte le prove: «Opzione 2» della proposta «sera». */
const SLOT = { g: "2026-10-28", o: "17:00" };
const SALTO_LUCCHETTO_MS = 21_000;

/** Tre lead con numero e nome diversi: nessuno deve vedere i dati degli altri. */
const TELEFONI = { 1: "333 123 4567", 2: "334 555 6677", 3: "335 777 8899" };
const NOMI = { 1: "Anna", 2: "Marta", 3: "Giulia" };
const leadN = (n, extra = {}) => lead(ID(n), { nome: NOMI[n], telefono: TELEFONI[n], ...extra });
const corpoN = (n, scelta) => corpoScelta(scelta, { telefono: `+39 ${TELEFONI[n]}` });
const cifreDi = (n) => `39${TELEFONI[n].replace(/\D/g, "")}`;
const testoN = (n, parola) => corpoTesto(parola, { telefono: `+39 ${TELEFONI[n]}` });

// ═══ LA REGIA ═════════════════════════════════════════════════════════════

/** Le porte semplici del mondo (tutte asincrone): ognuna è un punto in cui un
 *  altro attore può inserirsi. `adesso` e `avviso` sono sincrone e non cedono. */
const PORTE_SEMPLICI = [
  "config",
  "utente",
  "consulenti",
  "schedeAgenda",
  "blocchi",
  "schedeDelNumero",
  "scheda",
  "scriviScheda",
  "proposta",
  "scriviProposta",
  "contatore",
  "scriviContatore",
  "statoSecondo",
  "scriviContatto",
  "nonScrivere",
];

/** Un generatore di numeri a caso che si può rifare con lo stesso seme. */
function mulberry32(seme) {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** La regia di UN mondo. Gli attori partono tutti insieme e si fermano alla
 *  prima chiamata; `esegui` li fa avanzare uno scatto alla volta. */
function creaRegia(m, quiete) {
  const attori = [];
  const storia = [];
  let seq = 0;

  const cedi = (att, nome) =>
    new Promise((via) => {
      att.pendenti.push({ att, nome, n: ++seq, via });
    });

  const nuovo = (nome) => {
    const att = { nome, pendenti: [], finito: false, esito: null, errore: null };
    attori.push(att);
    return att;
  };
  const chiudi = (att, p) => {
    att.promessa = p.then(
      (r) => {
        att.esito = r;
        att.finito = true;
      },
      (e) => {
        att.errore = e;
        att.finito = true;
      },
    );
  };

  /** Le porte di un attore: ogni chiamata aspetta il via, poi va al mondo. */
  const porteDi = (att) => {
    const una =
      (nome, fn) =>
      async (...a) => {
        await cedi(att, nome);
        return fn(...a);
      };
    const p = { adesso: m.porte.adesso, avviso: m.porte.avviso };
    for (const nome of PORTE_SEMPLICI) p[nome] = una(nome, m.porte[nome]);
    p.lucchetto = {
      prendi: una("lucchetto.prendi", m.porte.lucchetto.prendi),
      lascia: una("lucchetto.lascia", m.porte.lucchetto.lascia),
    };
    p.stanza = {
      leggi: una("stanza.leggi", m.porte.stanza.leggi),
      scrivi: una("stanza.scrivi", m.porte.stanza.scrivi),
      elimina: una("stanza.elimina", m.porte.stanza.elimina),
    };
    p.attesa = una("attesa", m.porte.attesa);
    return p;
  };

  const r = {
    attori,
    storia,
    /** Una richiesta: `corpo(porte)` è la funzione che la esegue. `ritardo`: la
     *  richiesta comincia solo quando la regia le dà il primo via (l'orologio
     *  di quel momento è il suo «inizio»). */
    avvia(nome, corpo, { ritardo = false } = {}) {
      const att = nuovo(nome);
      chiudi(
        att,
        (async () => {
          if (ritardo) await cedi(att, "avvio");
          return corpo(porteDi(att));
        })(),
      );
      return att;
    },
    /** Una mossa sola (la setter dal browser, un salto dell'orologio). */
    evento(nome, fn) {
      const att = nuovo(nome);
      chiudi(
        att,
        (async () => {
          await cedi(att, "evento");
          fn();
        })(),
      );
      return att;
    },
    attore: (nome) => attori.find((a) => a.nome === nome),
    pendenti: () =>
      attori
        .filter((a) => !a.finito)
        .flatMap((a) => a.pendenti)
        .sort((x, y) => x.n - y.n),
    async parti() {
      await quiete();
    },
    /** Lascia partire UNA chiamata e aspetta che tutti siano di nuovo fermi. */
    async passo(p) {
      p.att.pendenti.splice(p.att.pendenti.indexOf(p), 1);
      storia.push({ att: p.att.nome, nome: p.nome });
      p.via();
      await quiete();
    },
    /** Porta un attore avanti (le sue chiamate, in ordine) finché `fermati()` è
     *  vero, o finché ha finito, o finché ha una chiamata di quel `nome` ferma
     *  (che NON parte). */
    async finoA(nomeAttore, { prima, quando } = {}) {
      const att = r.attore(nomeAttore);
      for (let i = 0; i < 2000; i++) {
        if (att.finito || att.pendenti.length === 0) return;
        if (prima && att.pendenti.some((p) => p.nome === prima)) return;
        if (quando && quando()) return;
        await r.passo(att.pendenti[0]);
      }
      throw new Error("finoA: troppi passi");
    },
    /** Lascia partire la mossa ferma di un attore (anche una chiamata sola). */
    async via(nomeAttore, nome) {
      const att = r.attore(nomeAttore);
      const p = nome ? att.pendenti.find((x) => x.nome === nome) : att.pendenti[0];
      if (!p) throw new Error(`via: ${nomeAttore} non ha ${nome ?? "nessuna chiamata"} ferma`);
      await r.passo(p);
    },
    /** Fa girare tutto fino alla fine. `scegli(pendenti)` dà l'indice di quella
     *  che parte. */
    async esegui(scegli) {
      await quiete();
      for (let passi = 0; ; passi++) {
        const ferme = r.pendenti();
        if (ferme.length === 0) break;
        if (passi > 4000) throw new Error("troppi passi: la regia non finisce");
        await r.passo(ferme[scegli(ferme, passi)]);
      }
      await Promise.all(attori.map((a) => a.promessa));
    },
    /** La sequenza in breve: «A12 B30 A5». */
    traccia() {
      const out = [];
      for (const s of storia) {
        const ultimo = out[out.length - 1];
        if (ultimo && ultimo.a === s.att) ultimo.n++;
        else out.push({ a: s.att, n: 1 });
      }
      return out.map((x) => `${x.a}${x.n}`).join(" ");
    },
  };
  return r;
}

// ═══ LE INVARIANTI ════════════════════════════════════════════════════════

const comeMinuti = (ora) => {
  const [h, mi] = String(ora).split(":").map(Number);
  return h * 60 + mi;
};

/** Le coppie di schede vive che si sovrappongono sullo stesso consulente e giorno. */
function sovrapposte(m, BKG) {
  const vive = m.schede.filter(
    (s) =>
      BKG.tieneLoSlot(s.data.stato) &&
      s.data.consulenteId &&
      s.data.dataMeeting &&
      /^\d{1,2}:\d{2}$/.test(String(s.data.oraMeeting)),
  );
  const out = [];
  for (let i = 0; i < vive.length; i++)
    for (let j = i + 1; j < vive.length; j++) {
      const a = vive[i].data;
      const b = vive[j].data;
      if (a.consulenteId !== b.consulenteId || a.dataMeeting !== b.dataMeeting) continue;
      const da = comeMinuti(a.oraMeeting);
      const db = comeMinuti(b.oraMeeting);
      const la = Number(a.durataMeeting) > 0 ? Number(a.durataMeeting) : 60;
      const lb = Number(b.durataMeeting) > 0 ? Number(b.durataMeeting) : 60;
      if (da < db + lb && db < da + la)
        out.push({
          ids: [vive[i].id, vive[j].id],
          consulenteId: a.consulenteId,
          giorno: a.dataMeeting,
          ore: [a.oraMeeting, b.oraMeeting],
        });
    }
  return out;
}

const leggi = (g) => {
  try {
    return JSON.parse(g);
  } catch {
    return null;
  }
};

/** Le righe della stanza che non c'erano (o sono cambiate) rispetto all'inizio. */
function righeNuove(m, iniziali) {
  const out = [];
  for (const [k, v] of m.righe)
    if (/^(meet|fascia|attesi):/.test(k) && iniziali.get(k) !== v) out.push([k, v]);
  return out;
}

/** Le righe della stanza (meet / fascia / attesi) devono essere di una
 *  prenotazione che c'è. «C'è» = la scheda ha il marcatore `prenotatoChat`.
 *  Orfana = riga di un lead senza prenotazione, o con un codice che nessuna
 *  prenotazione ha. Mancante = prenotazione senza il suo `meet:<lead>`. */
function problemiStanza(m, iniziali) {
  const out = [];
  const prenotati = new Set(m.schede.filter((s) => s.data.prenotatoChat).map((s) => s.id));
  const codiciVivi = new Set();
  for (const [k, v] of righeNuove(m, iniziali)) {
    const riga = leggi(v);
    if (/^meet:/.test(k) && riga?.leadId && prenotati.has(riga.leadId)) codiciVivi.add(riga.code);
  }
  for (const [k, v] of righeNuove(m, iniziali)) {
    const riga = leggi(v);
    if (/^meet:/.test(k)) {
      if (!riga || !prenotati.has(riga.leadId)) out.push(`riga orfana ${k} (nessuna prenotazione)`);
    } else if (/^fascia:/.test(k)) {
      if (!riga || !codiciVivi.has(riga.code)) out.push(`riga orfana ${k} (stanza che non c'è)`);
    } else if (/^attesi:/.test(k)) {
      if (!codiciVivi.has(k.slice("attesi:".length)))
        out.push(`riga orfana ${k} (stanza che non c'è)`);
    }
  }
  for (const id of prenotati) {
    const s = m.schede.find((x) => x.id === id);
    if (!iniziali.has(`meet:${id}`) && !m.righe.has(`meet:${id}`))
      out.push(`prenotazione di ${id} senza la sua stanza (meet:)`);
    const dopo = leggi(m.righe.get(`meet:${id}`));
    const codice = String(s.data.linkMeeting ?? "")
      .split("/")
      .pop();
    if (dopo && s.data.linkMeeting?.includes("hair-genius-hub") && dopo.code !== codice)
      out.push(`la stanza di ${id} non è quella del link in scheda`);
    //  La riga «fascia» (stesso consulente, stessa ora) deve esserci e puntare
    //  alla stanza di chi ha prenotato quell'ora.
    if (dopo) {
      const fascia = leggi(m.righe.get(`fascia:${dopo.consultantId}:${dopo.quando}`));
      if (!fascia || fascia.code !== dopo.code)
        out.push(
          `riga stanza persa: manca la fascia di ${id} (${dopo.consultantId} ${dopo.quando})`,
        );
    }
  }
  return out;
}

/** La scheda com'era prima, senza ciò che il «Da ricontattare» aggiunge. */
const comePrima = (data, prima) => {
  const x = structuredClone(data);
  delete x.contattoWa;
  if (typeof prima.note === "string" && typeof x.note === "string" && x.note.startsWith(prima.note))
    x.note = prima.note;
  return x;
};

// ═══ LE ESPLORAZIONI ══════════════════════════════════════════════════════

/** Sequenze a seme. `insistenza` = probabilità di continuare con lo stesso
 *  attore (0 = a caso puro, 0.9 = lunghi tratti dello stesso). */
function aSeme(seme) {
  const rnd = mulberry32(seme * 7919 + 13);
  const insistenza = [0, 0.5, 0.85][seme % 3];
  let ultimo = null;
  return (ferme) => {
    let k = Math.floor(rnd() * ferme.length);
    if (ultimo && rnd() < insistenza) {
      const stessi = ferme.map((p, i) => [p, i]).filter(([p]) => p.att === ultimo);
      if (stessi.length) k = stessi[Math.floor(rnd() * stessi.length)][1];
    }
    ultimo = ferme[k].att;
    return k;
  };
}

/** Ricerca sistematica con al massimo `cambi` cambi di attore «in mezzo» (un
 *  cambio è «in mezzo» se l'attore che girava aveva ancora una chiamata da
 *  fare). Ricomincia da capo a ogni sequenza (`corsa(scegli)`), senza stato. */
async function sistematico(corsa, { cambi, max }) {
  const lavoro = [[]];
  let fatte = 0;
  let tagliate = false;
  while (lavoro.length) {
    if (fatte >= max) {
      tagliate = true;
      break;
    }
    const prefisso = lavoro.pop();
    const scelte = [];
    let ultimo = null;
    let usati = 0;
    await corsa((ferme) => {
      //  Una sola chiamata per attore (la più vecchia): fra chiamate dello
      //  stesso attore l'ordine è quello del codice.
      const opz = [];
      for (const p of ferme) if (!opz.some((o) => o.att === p.att)) opz.push(p);
      const iUltimo = opz.findIndex((o) => o.att === ultimo);
      if (iUltimo > 0) opz.unshift(...opz.splice(iUltimo, 1));
      const i = scelte.length;
      const costo = iUltimo >= 0 ? 1 : 0;
      if (i >= prefisso.length && opz.length > 1 && usati + costo <= cambi)
        for (let alt = 1; alt < opz.length; alt++) lavoro.push([...scelte, alt]);
      const k = i < prefisso.length ? prefisso[i] : 0;
      if (k > 0 && iUltimo >= 0) usati++;
      scelte.push(k);
      ultimo = opz[k].att;
      return ferme.indexOf(opz[k]);
    });
    fatte++;
  }
  return { fatte, tagliate };
}

// ═══ LA PROVA ═════════════════════════════════════════════════════════════

/** I difetti veri trovati dalle prove (vedi la testata). Un difetto si
 *  riconosce da una violazione; finché il codice non è corretto la prova lo
 *  segnala: un difetto da correggere è rosso, un `limite` dichiarato è solo una
 *  riga «LIMITE DICHIARATO» nell'uscita. */
const NOTI = {
  D1: {
    titolo: "dopo «preso» ripropone lo stesso orario appena preso",
    riconosci: (v) => v.startsWith("ripropone lo slot"),
  },
  D2: {
    titolo:
      "lucchetto scaduto: il disfare cancella o rimette la riga «fascia» dell'altra prenotazione",
    //  ⚠️ Solo la riga «fascia»: una riga meet / attesi orfana è un altro guaio.
    riconosci: (v) => v.startsWith("riga orfana fascia:") || v.startsWith("riga stanza persa"),
    limite: true,
  },
};

export async function proveDellaConcorrenzaPrenota(mod, { c, gruppo, radice }) {
  void radice;
  const P = mod["manychat/prenota"];
  const BKG = mod["booking-utils"];

  //  ⚠️ Le operazioni di cifratura (l'impronta del numero) non passano dalle
  //  porte e finiscono in un altro giro del motore: la regia deve sapere
  //  quando sono finite, altrimenti scambierebbe una richiesta che lavora per
  //  una ferma. Le si conta (e alla fine si rimettono a posto).
  const subtle = globalThis.crypto.subtle;
  let cifrature = 0;
  for (const nome of ["importKey", "sign"]) {
    const vera = subtle[nome].bind(subtle);
    subtle[nome] = (...a) => {
      cifrature++;
      return vera(...a).finally(() => {
        cifrature--;
      });
    };
  }
  const quiete = async () => {
    do await new Promise((r) => setImmediate(r));
    while (cifrature > 0);
  };

  //  ⚠️ Come in `prenota.mjs`: la funzione non deve chiamare nessuno.
  const fetchVero = globalThis.fetch;
  let chiamateEsterne = 0;
  globalThis.fetch = () => {
    chiamateEsterne++;
    throw new Error("la prenotazione in chat non deve chiamare nessuno");
  };

  const mondo = (o) => creaMondo(mod, o);
  const vedi = async (m, corpo) => (await P.gestisciPrenota(m.porte, m.richiesta(corpo))).risposta;

  /** Le righe di proposta dopo «sera» di ogni lead: ogni sequenza parte da lì. */
  const proposteDi = async (opz, numeri, ritocca) => {
    const m0 = mondo(opz);
    for (const n of numeri) await vedi(m0, testoN(n, "sera"));
    if (ritocca) await ritocca(m0);
    return Object.fromEntries(m0.righe);
  };

  const SPIA = [
    SENSIBILI.cognome,
    SENSIBILI.nota,
    SENSIBILI.telefono,
    SENSIBILI.altroCliente,
    "Bianchini",
    SENSIBILI.email,
    ...Object.values(TELEFONI),
    ...Object.values(TELEFONI).map((t) => t.replace(/\D/g, "")),
  ];
  const codice = (e) => e?.risposta?.codice;

  /** Lo slot è occupato, alla fine, su TUTTI i consulenti da una scheda viva
   *  che non è `escludi`? (Se sì, riproporlo a chi ha avuto «preso» è un errore.) */
  const pienoAlla = (m, slot, escludi) =>
    m.consulenti.every((co) =>
      m.schede.some(
        (s) =>
          s.id !== escludi &&
          BKG.tieneLoSlot(s.data.stato) &&
          s.data.consulenteId === co.id &&
          s.data.dataMeeting === slot.g &&
          comeMinuti(s.data.oraMeeting) < comeMinuti(slot.o) + 60 &&
          comeMinuti(slot.o) < comeMinuti(s.data.oraMeeting) + (Number(s.data.durataMeeting) || 60),
      ),
    );

  /** Le invarianti di OGNI sequenza (vedi la testata). */
  function invarianti(ctx) {
    const { m, regia, o } = ctx;
    const v = [];
    for (const a of regia.attori) {
      if (!a.finito) v.push(`${a.nome} non ha finito`);
      if (a.errore)
        v.push(`${a.nome} ha lanciato: ${a.errore?.message ?? JSON.stringify(a.errore)}`);
    }
    for (const x of sovrapposte(m, BKG)) {
      if (o.scusaSovrapposizione?.(x, ctx)) continue;
      v.push(
        `DOPPIA PRENOTAZIONE ${x.ids.join("+")} ${x.consulenteId} ${x.giorno} ${x.ore.join("/")}`,
      );
    }
    const attesi = new Set(o.lucchettiAttesi ?? []);
    for (const k of m.lucchetti()) if (!attesi.has(k)) v.push(`lucchetto rimasto ${k}`);
    v.push(...problemiStanza(m, ctx.righeIniziali));
    if (!o.avvisiAmmessi && m.avvisi.length) v.push(`avvisi: ${m.avvisi.join(",")}`);
    for (const a of o.attori) {
      if (a.tipo === "evento") continue;
      const e = ctx.esiti[a.nome];
      if (!e) continue;
      const cod = codice(e);
      if (o.codici && !o.codici.includes(cod)) v.push(`${a.nome}: codice inatteso «${cod}»`);
      const s = m.schede.find((x) => x.id === ID(a.lead));
      const prima = ctx.iniziale.schede.find((x) => x.id === ID(a.lead));
      const testo = e.risposta.testo;
      for (const dato of SPIA)
        if (testo.includes(dato)) v.push(`${a.nome}: la risposta contiene «${dato}»`);
      for (const [k, nomeAltro] of Object.entries(NOMI))
        if (Number(k) !== a.lead && testo.includes(nomeAltro))
          v.push(`${a.nome}: la risposta nomina ${nomeAltro}`);
      const toccata = o.schedeToccate?.includes(a.lead);
      if (cod === "prenotato") {
        if (!s.data.prenotatoChat) v.push(`${a.nome}: «Fatto» ma la scheda non ha la prenotazione`);
        else if (!toccata && !testo.includes(s.data.linkMeeting))
          v.push(`${a.nome}: «Fatto» ma il link della scheda non c'è nel testo`);
      }
      if (cod === "preso") {
        if (!toccata && !identiche(comePrima(s.data, prima.data), prima.data))
          v.push(`${a.nome}: «preso» ma la scheda non è com'era`);
        if (!/appena stato preso/.test(testo)) v.push(`${a.nome}: «preso» senza la frase`);
        //  D1: le proposte nuove non devono contenere l'orario rifiutato, se alla
        //  fine è davvero occupato.
        const slot = a.slot ?? SLOT;
        const riga = m.riga(ctx.chiavi[a.nome]);
        if (
          riga?.proposte.some((p) => p.g === slot.g && p.o === slot.o) &&
          pienoAlla(m, slot, ID(a.lead))
        )
          v.push(`ripropone lo slot appena preso (${a.nome})`);
      }
    }
    return v;
  }

  /** Una sequenza completa di uno scenario. */
  async function corsa(scenario, scegli) {
    const s = { ...scenario, ...(await scenario.crea()) };
    const regia = creaRegia(s.m, quiete);
    for (const a of s.attori) {
      if (a.tipo === "evento") regia.evento(a.nome, a.fn(s.m));
      else
        regia.avvia(a.nome, (porte) => P.gestisciPrenota(porte, s.m.richiesta(a.corpo)), {
          ritardo: !!a.ritardo,
        });
    }
    await regia.parti();
    if (s.guida) await s.guida(regia, s.m);
    await regia.esegui(scegli);
    const esiti = {};
    for (const a of regia.attori) if (a.esito) esiti[a.nome] = a.esito;
    const ctx = {
      m: s.m,
      regia,
      esiti,
      iniziale: s.iniziale,
      righeIniziali: s.righeIniziali,
      chiavi: s.chiavi,
      o: s,
    };
    const violazioni = [...invarianti(ctx), ...(s.controlla?.(ctx) ?? [])];
    return { ctx, violazioni, traccia: regia.traccia() };
  }

  /** Esplora uno scenario: ricerca sistematica (per ogni K di `cambi`) e semi. */
  async function esplora(scenario, { cambi = [1], max = 1500, semi = 60 } = {}) {
    const visti = new Map();
    const guai = [];
    const noti = {};
    let totale = 0;
    const registra = (r, come) => {
      totale++;
      for (const t of scenario.etichette?.(r.ctx) ?? []) visti.set(t, (visti.get(t) ?? 0) + 1);
      for (const viol of r.violazioni) {
        const id = (scenario.noti ?? ["D1"]).find((k) => NOTI[k].riconosci(viol));
        if (id) {
          noti[id] ??= { n: 0, primo: `${come} [${r.traccia}] ${viol}` };
          noti[id].n++;
        } else if (guai.length < 3) guai.push(`${come} [${r.traccia}] → ${viol}`);
      }
    };
    let tagliate = false;
    for (const k of cambi) {
      const r = await sistematico(
        async (scegli) => registra(await corsa(scenario, scegli), `sistematico(${k})`),
        { cambi: k, max },
      );
      tagliate ||= r.tagliate;
    }
    for (let seme = 1; seme <= semi; seme++)
      registra(await corsa(scenario, aSeme(seme)), `seme ${seme}`);
    return { totale, guai, visti, noti, tagliate };
  }

  /** Il resoconto di uno scenario nelle prove. `nonRicerca`: niente ricerca
   *  sistematica da riportare come «tagliata». */
  const verifica = async (nome, scenario, opzioni) => {
    const r = await esplora(scenario, opzioni);
    if (process.env.T9_DETTAGLI)
      console.log(
        `     [${nome}] ${r.totale} sequenze; viste: ${JSON.stringify(Object.fromEntries(r.visti))}; noti: ${JSON.stringify(r.noti)}`,
      );
    c(`${nome}: ${r.totale} sequenze, nessuna violazione`, [], r.guai);
    c(`${nome}: la ricerca sistematica non è stata tagliata`, false, r.tagliate);
    for (const [tag, atteso] of Object.entries(scenario.copertura ?? {}))
      c(
        `${nome}: copertura «${tag}» vista almeno ${atteso} volta`,
        true,
        (r.visti.get(tag) ?? 0) >= atteso,
      );
    for (const id of scenario.noti ?? ["D1"]) attesa(nome, id, r.noti[id]);
    return r;
  };

  /** Un difetto noto: normale se non c'è, ATTESA DA CORREGGERE se c'è. */
  const attesa = (nome, id, trovato) => {
    const n = trovato?.n ?? 0;
    if (NOTI[id].limite) {
      if (n > 0)
        c(
          `${nome}: LIMITE DICHIARATO ${id}: ${NOTI[id].titolo}; in ${n} sequenze, la prima [${trovato.primo}]`,
          true,
          true,
        );
    } else c(`${nome}: ${NOTI[id].titolo} (${id})`, 0, n);
  };

  /** Costruisce uno scenario da una descrizione. */
  const scenarioDa = (def) => ({
    ...def,
    crea: async () => {
      const m = mondo({
        consulenti: def.consulenti,
        schede: def.schede,
        righe: def.righe,
        blocchi: def.blocchi,
        cfg: def.cfg,
      });
      if (def.prepara) await def.prepara(m);
      const chiavi = {};
      for (const a of def.attori)
        if (a.tipo !== "evento") chiavi[a.nome] = await m.chiaveProposta(cifreDi(a.lead));
      return {
        m,
        chiavi,
        iniziale: m.fotografia(),
        righeIniziali: new Map(m.righe),
        attori: def.attori.map((a) =>
          a.tipo === "evento" ? a : { ...a, corpo: corpoN(a.lead, a.scelta ?? 2) },
        ),
      };
    },
  });

  let stampato = false;
  const consFil = [FIL()];
  const consFilBea = [FIL(), BEA()];
  const quanti = (m, porta, chiave) =>
    m.scritture.filter((s) => s.porta === porta && (chiave === undefined || s.chiave === chiave))
      .length;
  const prenotati = (esiti, nomi) => nomi.filter((x) => codice(esiti[x]) === "prenotato");
  /** «Mai a metà»: ogni scheda è com'era (salvo il «Da ricontattare») oppure
   *  completa; e una risposta di errore non convive con una scheda prenotata,
   *  a meno che a prenotarla sia stata un'altra richiesta dello stesso lead. */
  const nonAMetà = ({ esiti, m, iniziale }, coppie) => {
    const v = [];
    for (const k of new Set(coppie.map(([, lead]) => lead))) {
      const s = m.scheda(ID(k)).data;
      const prima = iniziale.schede.find((x) => x.id === ID(k)).data;
      const completa = !!s.prenotatoChat && s.stato === "appuntamento_fissato" && !!s.linkMeeting;
      const sue = coppie.filter(([, lead]) => lead === k).map(([nome]) => nome);
      if (!identiche(comePrima(s, prima), prima) && !completa)
        v.push(`lead ${k}: la scheda è a metà`);
      if (
        completa &&
        !sue.some((n) => codice(esiti[n]) === "prenotato") &&
        sue.every((n) => ["errore", "tempo"].includes(codice(esiti[n])))
      )
        v.push(`lead ${k}: errore ma la scheda è prenotata`);
    }
    return v;
  };

  try {
    // ═══ 1. DUE LEAD, STESSO CONSULENTE, STESSO SLOT ═══════════════════════
    gruppo("PRENOTA · CONCORRENZA · DUE LEAD, STESSO CONSULENTE, STESSO SLOT (T9.1)");
    {
      const righe = await proposteDi({ consulenti: consFil, schede: [leadN(1), leadN(2)] }, [1, 2]);
      const base = {
        consulenti: consFil,
        schede: [leadN(1), leadN(2)],
        righe,
        attori: [
          { nome: "A", lead: 1 },
          { nome: "B", lead: 2 },
        ],
        codici: ["prenotato", "preso"],
        etichette: ({ esiti, m }) => {
          const t = [];
          const vincitore = ["A", "B"].find((x) => codice(esiti[x]) === "prenotato");
          if (vincitore) t.push(`vince ${vincitore}`);
          if (m.attese.length > 0) t.push("lucchetto del consulente occupato");
          return t;
        },
        copertura: { "vince A": 5, "vince B": 5, "lucchetto del consulente occupato": 1 },
        controlla: ({ esiti, m }) => {
          const v = [];
          const vincitori = prenotati(esiti, ["A", "B"]);
          const persi = ["A", "B"].filter((x) => codice(esiti[x]) === "preso");
          if (vincitori.length !== 1) v.push(`i vincitori sono ${vincitori.length}, deve essere 1`);
          if (persi.length !== 1) v.push(`i «preso» sono ${persi.length}, deve essere 1`);
          for (const x of vincitori) {
            const s = m.scheda(ID(x === "A" ? 1 : 2)).data;
            if (
              s.consulenteId !== "c-fil" ||
              s.dataMeeting !== SLOT.g ||
              s.oraMeeting !== SLOT.o ||
              s.stato !== "appuntamento_fissato"
            )
              v.push(
                `il vincitore ${x} non ha lo slot: ${JSON.stringify([s.stato, s.consulenteId, s.dataMeeting, s.oraMeeting])}`,
              );
          }
          for (const x of persi)
            if (!/^proposte[123]$/.test(esiti[x].risposta.esito))
              v.push(`${x}: «preso» senza nuove proposte (${esiti[x].risposta.esito})`);
          return v;
        },
      };
      const scenario = scenarioDa(base);
      await verifica("1 · stesso slot, Filippo solo", scenario, {
        cambi: [1, 2],
        max: 2500,
        semi: 120,
      });
      //  Guidato: A ha il lucchetto di Filippo e sta per scrivere; B arriva, trova il
      //  lucchetto occupato e riceve «preso» con le nuove proposte. Le nuove
      //  proposte non devono contenere l'orario che A sta per prendere (D1).
      await verifica(
        "1 · A ha il lucchetto, B arriva",
        scenarioDa({
          ...base,
          guida: async (regia) => {
            await regia.finoA("A", { prima: "scriviScheda" });
            await regia.finoA("B");
          },
          copertura: { "vince A": 1, "lucchetto del consulente occupato": 1 },
          controlla: (ctx) => {
            const v = base.controlla(ctx);
            if (codice(ctx.esiti.B) !== "preso")
              v.push(`B doveva avere «preso», ha «${codice(ctx.esiti.B)}»`);
            if (process.env.T9_DETTAGLI && !stampato) {
              stampato = true;
              console.log(
                `     [testo di B]\n${ctx.esiti.B.risposta.testo.replace(/^/gm, "       | ")}`,
              );
            }
            return v;
          },
        }),
        { cambi: [1], max: 100, semi: 20 },
      );
    }

    // ═══ 2. DUE LEAD, DUE CONSULENTI ═══════════════════════════════════════
    gruppo("PRENOTA · CONCORRENZA · DUE LEAD, DUE CONSULENTI LIBERI (T9.2)");
    {
      const righe = await proposteDi(
        { consulenti: consFilBea, schede: [leadN(1), leadN(2)] },
        [1, 2],
      );
      const scenario = scenarioDa({
        consulenti: consFilBea,
        schede: [leadN(1), leadN(2)],
        righe,
        attori: [
          { nome: "A", lead: 1 },
          { nome: "B", lead: 2 },
        ],
        codici: ["prenotato"],
        etichette: ({ m }) => {
          const t = [];
          t.push(m.scheda(ID(1)).data.consulenteId === "c-fil" ? "A ha Filippo" : "A ha Bea");
          if (m.attese.length > 0) t.push("lucchetto occupato, poi il collega");
          return t;
        },
        copertura: { "A ha Filippo": 5, "A ha Bea": 5, "lucchetto occupato, poi il collega": 1 },
        controlla: ({ m }) => {
          const dati = [1, 2].map((n) => m.scheda(ID(n)).data);
          const v = [];
          if (dati[0].consulenteId === dati[1].consulenteId)
            v.push(`stesso consulente per tutti e due: ${dati[0].consulenteId}`);
          for (const d of dati)
            if (d.dataMeeting !== SLOT.g || d.oraMeeting !== SLOT.o)
              v.push("uno dei due non ha lo slot");
          return v;
        },
      });
      await verifica("2 · stesso slot, Filippo e Bea", scenario, {
        cambi: [1, 2],
        max: 2500,
        semi: 120,
      });

      //  Stesso giorno, ore diverse: il lucchetto è per consulente e GIORNO, quindi
      //  chi trova Filippo «occupato» da un'altra prenotazione dello stesso giorno
      //  deve passare a Bea (non dire «preso» con un collega libero).
      const alle18 = { g: SLOT.g, o: "18:00" };
      const righe2 = await proposteDi(
        { consulenti: consFilBea, schede: [leadN(1), leadN(2)] },
        [1, 2],
        async (m0) => {
          m0.righe.set(
            await m0.chiaveProposta(cifreDi(2)),
            JSON.stringify({
              v: 1,
              il: ADESSO.toISOString(),
              fascia: "sera",
              fasciaChiesta: "sera",
              pagina: 1,
              proposte: [alle18],
              mostrati: [alle18],
            }),
          );
        },
      );
      const scenario2 = scenarioDa({
        consulenti: consFilBea,
        schede: [leadN(1), leadN(2)],
        righe: righe2,
        attori: [
          { nome: "A", lead: 1 },
          { nome: "B", lead: 2, scelta: 1, slot: alle18 },
        ],
        codici: ["prenotato"],
        etichette: ({ m }) => {
          const t = [];
          const ca = m.scheda(ID(1)).data.consulenteId;
          const cb = m.scheda(ID(2)).data.consulenteId;
          t.push(ca === cb ? "stesso consulente, ore diverse" : "consulenti diversi");
          if (m.attese.length > 0 && ca !== cb) t.push("il collega per via del lucchetto");
          return t;
        },
        copertura: {
          "stesso consulente, ore diverse": 5,
          "consulenti diversi": 5,
          "il collega per via del lucchetto": 1,
        },
        controlla: ({ m }) => {
          const a = m.scheda(ID(1)).data;
          const b = m.scheda(ID(2)).data;
          return a.oraMeeting === "17:00" && b.oraMeeting === "18:00"
            ? []
            : ["le ore non sono quelle scelte"];
        },
      });
      await verifica("2 · stesso giorno, ore diverse", scenario2, {
        cambi: [1],
        max: 500,
        semi: 150,
      });
    }

    // ═══ 3. SLOT SOVRAPPOSTI MA NON UGUALI ═════════════════════════════════
    gruppo("PRENOTA · CONCORRENZA · SLOT SOVRAPPOSTI, 17:00 E 17:30 (T9.3)");
    {
      //  Un consulente con due fasce sfalsate (14:00-19:00 e 14:30-19:30): ha sia
      //  le 17:00 sia le 17:30. Una prenotazione di un'ora alle 17:00 copre le
      //  17:30, e viceversa.
      const DORA = () =>
        consulente("c-dora", "Dora", { priorita: 1 }, [
          { inizio: "09:00", fine: "13:00" },
          { inizio: "14:00", fine: "19:00" },
          { inizio: "14:30", fine: "19:30" },
        ]);
      const alle1730 = { g: SLOT.g, o: "17:30" };
      const O = mod["manychat/prenota-orari"];
      const libere = (schede) =>
        O.slotLiberiDelGiorno({
          consulente: DORA(),
          giorno: SLOT.g,
          durata: 60,
          schede,
          blocchi: [],
          adesso: ADESSO,
          preavvisoOre: 3,
        });
      c(
        "(controllo del mondo) Dora ha 17:00 e 17:30",
        true,
        ["17:00", "17:30"].every((o) => libere([]).includes(o)),
      );
      c(
        "(controllo del mondo) con uno alle 17:00 le 17:30 non sono libere, e viceversa",
        [false, false],
        [
          libere([consulenza(ID(7), "c-dora", SLOT.g, "17:00")]).includes("17:30"),
          libere([consulenza(ID(7), "c-dora", SLOT.g, "17:30")]).includes("17:00"),
        ],
      );
      const righe = await proposteDi(
        { consulenti: [DORA()], schede: [leadN(1), leadN(2)] },
        [1, 2],
        async (m0) => {
          m0.righe.set(
            await m0.chiaveProposta(cifreDi(2)),
            JSON.stringify({
              v: 1,
              il: ADESSO.toISOString(),
              fascia: "sera",
              fasciaChiesta: "sera",
              pagina: 1,
              proposte: [alle1730],
              mostrati: [alle1730],
            }),
          );
        },
      );
      const scenario = scenarioDa({
        consulenti: [DORA()],
        schede: [leadN(1), leadN(2)],
        righe,
        attori: [
          { nome: "A", lead: 1 },
          { nome: "B", lead: 2, scelta: 1, slot: alle1730 },
        ],
        codici: ["prenotato", "preso"],
        etichette: ({ esiti }) => {
          const t = [];
          if (codice(esiti.A) === "prenotato") t.push("vince il 17:00");
          if (codice(esiti.B) === "prenotato") t.push("vince il 17:30");
          return t;
        },
        copertura: { "vince il 17:00": 5, "vince il 17:30": 5 },
        controlla: ({ esiti }) => {
          const n = prenotati(esiti, ["A", "B"]).length;
          return n === 1 ? [] : [`i vincitori sono ${n}, deve essere 1`];
        },
      });
      await verifica("3 · 17:00 contro 17:30, stesso consulente", scenario, {
        cambi: [1],
        max: 500,
        semi: 150,
      });
    }

    // ═══ 4. LA SETTER DAL BROWSER NELLO STESSO SLOT ════════════════════════
    gruppo("PRENOTA · CONCORRENZA · LA SETTER SALVA NELLO STESSO SLOT A METÀ (T9.4)");
    {
      const SET_LINK = "https://x.example/meetly/set-set-set";
      const righe = await proposteDi({ consulenti: consFil, schede: [leadN(1), leadN(3)] }, [1]);
      const nelloSlot = (m) => () =>
        m.setter(ID(3), {
          stato: "appuntamento_fissato",
          consulenteId: "c-fil",
          dataMeeting: SLOT.g,
          oraMeeting: SLOT.o,
          durataMeeting: 60,
          linkMeeting: SET_LINK,
        });
      //  La setter vince sempre: se scrive PRIMA della nostra ultima lettura
      //  dell'agenda, noi non prenotiamo (o disfiamo); se scrive dopo, la doppia
      //  prenotazione l'ha fatta lei (come fa oggi dal browser) e non è colpa
      //  nostra.
      const dopoLaVerifica = (x, ctx) => {
        const st = ctx.regia.storia;
        const quando = st.findIndex((s) => s.att === "E");
        let ultima = -1;
        st.forEach((s, i) => {
          if (s.att === "A" && s.nome === "schedeAgenda") ultima = i;
        });
        return codice(ctx.esiti.A) === "prenotato" && quando > ultima;
      };
      const base = {
        consulenti: consFil,
        schede: [leadN(1), leadN(3)],
        righe,
        attori: [
          { nome: "A", lead: 1 },
          { nome: "E", tipo: "evento", fn: nelloSlot },
        ],
        codici: ["prenotato", "preso"],
        scusaSovrapposizione: dopoLaVerifica,
        etichette: ({ esiti, m }) => {
          const t = [];
          const scritteA = quanti(m, "scriviScheda", ID(1));
          if (codice(esiti.A) === "preso" && scritteA === 0) t.push("preso senza scrivere");
          if (codice(esiti.A) === "preso" && scritteA >= 2) t.push("scritto e disfatto");
          if (codice(esiti.A) === "prenotato") t.push("prenotato, la setter dopo");
          return t;
        },
        controlla: ({ m }) => {
          const s = m.scheda(ID(3)).data;
          return s.linkMeeting === SET_LINK && s.oraMeeting === SLOT.o
            ? []
            : ["la scheda della setter è stata toccata"];
        },
      };
      await verifica(
        "4 · setter nello slot (ovunque)",
        scenarioDa({
          ...base,
          copertura: {
            "preso senza scrivere": 3,
            "scritto e disfatto": 3,
            "prenotato, la setter dopo": 3,
          },
        }),
        { cambi: [1, 2], max: 500, semi: 60 },
      );
      //  Guidato: la setter scrive DOPO la nostra scrittura e PRIMA della nostra
      //  verifica. Noi disfiamo, la setter vince, la scheda torna com'era.
      const guidato = scenarioDa({
        ...base,
        guida: async (regia, m) => {
          await regia.finoA("A", { quando: () => quanti(m, "scriviScheda", ID(1)) >= 1 });
          await regia.via("E");
        },
        controlla: (ctx) => {
          const v = base.controlla(ctx);
          const { esiti, m } = ctx;
          if (codice(esiti.A) !== "preso")
            v.push(`A dovrebbe avere «preso», ha «${codice(esiti.A)}»`);
          if (quanti(m, "scriviScheda", ID(1)) !== 2)
            v.push("A doveva scrivere e poi disfare (2 scritture)");
          const riga = m.riga(ctx.chiavi.A);
          if (riga?.proposte.some((p) => p.g === SLOT.g && p.o === SLOT.o))
            v.push("le nuove proposte contengono lo slot della setter");
          const righeStanza = [...m.righe.keys()].filter((k) => /^(meet|fascia|attesi):/.test(k));
          if (righeStanza.length > 0)
            v.push(`restano righe della stanza: ${righeStanza.join(", ")}`);
          return v;
        },
      });
      await verifica("4 · setter fra la scrittura e la verifica", guidato, {
        cambi: [1],
        max: 100,
        semi: 20,
      });
    }

    // ═══ 5. LA SETTER TOCCA LA SCHEDA DEL LEAD ═════════════════════════════
    gruppo("PRENOTA · CONCORRENZA · LA SETTER TOCCA LA SCHEDA DEL LEAD A METÀ (T9.5)");
    {
      const righe = await proposteDi({ consulenti: consFilBea, schede: [leadN(1)] }, [1]);
      const NOTA = "nota della setter";
      const varianti = {
        nota: {
          fn: (m) => () => m.setter(ID(1), { note: `${m.scheda(ID(1)).data.note}\n${NOTA}` }),
          codici: ["prenotato"],
        },
        annullato: {
          fn: (m) => () => m.setter(ID(1), { stato: "annullato" }),
          codici: ["prenotato", "non_prenotabile"],
        },
        altrove: {
          fn: (m) => () =>
            m.setter(ID(1), {
              stato: "appuntamento_fissato",
              consulenteId: "c-bea",
              dataMeeting: "2026-10-30",
              oraMeeting: "10:00",
              durataMeeting: 60,
              linkMeeting: "https://x.example/meetly/set-set-set",
            }),
          codici: ["prenotato", "gia_fissato"],
        },
      };
      for (const [nome, vr] of Object.entries(varianti)) {
        const base = {
          consulenti: consFilBea,
          schede: [leadN(1)],
          righe,
          attori: [
            { nome: "A", lead: 1 },
            { nome: "E", tipo: "evento", fn: vr.fn },
          ],
          codici: vr.codici,
          schedeToccate: [1],
          etichette: ({ esiti, regia }) => {
            const t = [];
            const scritture = regia.storia.filter(
              (s) => s.att === "A" && s.nome === "scriviScheda",
            ).length;
            if (scritture >= 2) t.push("scrittura ripetuta");
            t.push(`A: ${codice(esiti.A)}`);
            return t;
          },
          controlla: ({ esiti, m }) => {
            const s = m.scheda(ID(1)).data;
            const v = [];
            if (codice(esiti.A) !== "prenotato" && s.prenotatoChat)
              v.push("A non ha prenotato ma la scheda ha il marcatore");
            if (nome === "nota") {
              if (!s.note.includes(NOTA)) v.push("la nota della setter si è persa");
              if (!/Ha prenotato il cliente dalla chat/.test(s.note))
                v.push("la nota della prenotazione si è persa");
              if (s.stato !== "appuntamento_fissato" || s.oraMeeting !== SLOT.o)
                v.push("la scheda non è prenotata");
            }
            if (nome === "annullato" && s.stato !== "annullato")
              v.push("lo stato della setter si è perso");
            if (
              nome === "altrove" &&
              codice(esiti.A) === "gia_fissato" &&
              s.dataMeeting !== "2026-10-30"
            )
              v.push("l'appuntamento della setter si è perso");
            return v;
          },
        };
        await verifica(
          `5 · setter: ${nome} (ovunque)`,
          scenarioDa({ ...base, copertura: nome === "nota" ? { "scrittura ripetuta": 1 } : {} }),
          { cambi: [1, 2], max: 500, semi: 60 },
        );
        //  Guidato: la setter scrive fra la nostra rilettura della scheda e la
        //  nostra scrittura (T9.5): la scrittura condizionata dice «cambiata»,
        //  si rilegge e si riprova.
        await verifica(
          `5 · setter: ${nome}, prima della nostra scrittura`,
          scenarioDa({
            ...base,
            guida: async (regia) => {
              await regia.finoA("A", { prima: "scriviScheda" });
              await regia.via("E");
            },
            copertura: nome === "nota" ? { "scrittura ripetuta": 1 } : {},
            controlla: (ctx) => {
              const v = base.controlla(ctx);
              const attesa =
                nome === "nota"
                  ? "prenotato"
                  : nome === "annullato"
                    ? "non_prenotabile"
                    : "gia_fissato";
              if (codice(ctx.esiti.A) !== attesa)
                v.push(`A dovrebbe avere «${attesa}», ha «${codice(ctx.esiti.A)}»`);
              return v;
            },
          }),
          { cambi: [1], max: 100, semi: 20 },
        );
      }
    }

    // ═══ 6. I LUCCHETTI: SCADUTI, NON SCADUTI, RILASCIATI ══════════════════
    gruppo("PRENOTA · CONCORRENZA · I LUCCHETTI (T9.6)");
    {
      const TI = mod["manychat/prenota-tipi"];
      const KFIL = TI.chiaveLucchettoConsulente("c-fil", SLOT.g);
      const KLEAD = TI.chiaveLucchettoLead(ID(1));
      const righe = await proposteDi({ consulenti: consFilBea, schede: [leadN(1)] }, [1]);
      const dopoMs = (ms) => new Date(ADESSO.getTime() + ms).toISOString();
      const altrui = (m, chiave, ms) =>
        m.righe.set(chiave, JSON.stringify({ di: "un-altro-giro", fino: dopoMs(ms) }));
      /** Una richiesta sola, con un lucchetto già messo da qualcun altro. */
      const unica = async (nome, def, attesa) => {
        const scenario = scenarioDa({
          consulenti: def.consulenti,
          schede: [leadN(1)],
          righe,
          attori: [{ nome: "A", lead: 1 }],
          codici: [def.codice],
          lucchettiAttesi: def.restano ?? [],
          prepara: def.prepara,
          controlla: (ctx) => attesa(ctx),
        });
        const r = await corsa(scenario, () => 0);
        c(`${nome}`, [], r.violazioni);
        return r;
      };
      let valorePrima;
      await unica(
        "lucchetto del consulente NON scaduto, Filippo solo: «preso», il lucchetto non si tocca",
        {
          consulenti: consFil,
          codice: "preso",
          restano: [KFIL],
          prepara: (m) => {
            altrui(m, KFIL, 10_000);
            valorePrima = m.righe.get(KFIL);
          },
        },
        ({ m }) => {
          const v = [];
          if (m.righe.get(KFIL) !== valorePrima) v.push("il lucchetto di un altro è stato toccato");
          if (JSON.stringify(m.attese) !== "[300]")
            v.push(`attese ${JSON.stringify(m.attese)}, doveva essere [300]`);
          if (m.scritture.some((s) => ["scriviScheda", "stanza.scrivi"].includes(s.porta)))
            v.push("ha scritto lo stesso");
          return v;
        },
      );
      await unica(
        "lucchetto del consulente NON scaduto, c'è Bea libera: prenota Bea",
        {
          consulenti: consFilBea,
          codice: "prenotato",
          restano: [KFIL],
          prepara: (m) => altrui(m, KFIL, 10_000),
        },
        ({ m }) => (m.scheda(ID(1)).data.consulenteId === "c-bea" ? [] : ["non ha preso Bea"]),
      );
      await unica(
        "lucchetto del consulente SCADUTO: si riprende e si rilascia",
        {
          consulenti: consFil,
          codice: "prenotato",
          prepara: (m) => altrui(m, KFIL, -1000),
        },
        ({ m }) => (m.scheda(ID(1)).data.consulenteId === "c-fil" ? [] : ["non ha preso Filippo"]),
      );
      await unica(
        "lucchetto che scade DURANTE l'attesa di 300 ms: il secondo tentativo lo prende",
        {
          consulenti: consFil,
          codice: "prenotato",
          prepara: (m) => altrui(m, KFIL, 200),
        },
        ({ m }) =>
          JSON.stringify(m.attese) === "[300]" ? [] : [`attese ${JSON.stringify(m.attese)}`],
      );
      let valoreLead;
      await unica(
        "lucchetto del LEAD non scaduto: silenzio, nessuna scrittura",
        {
          consulenti: consFil,
          codice: "occupato",
          restano: [KLEAD],
          prepara: (m) => {
            altrui(m, KLEAD, 10_000);
            valoreLead = m.righe.get(KLEAD);
          },
        },
        ({ m, esiti }) => {
          const v = [];
          if (m.righe.get(KLEAD) !== valoreLead) v.push("il lucchetto di un altro è stato toccato");
          if (m.scritture.some((s) => s.porta !== "scriviContatore"))
            v.push(`ha scritto: ${JSON.stringify(m.scritture)}`);
          if (esiti.A.risposta.esito !== "nessuno" || esiti.A.risposta.testo !== "")
            v.push("doveva tacere");
          return v;
        },
      );
      await unica(
        "lucchetto del LEAD scaduto: prenota",
        {
          consulenti: consFil,
          codice: "prenotato",
          prepara: (m) => altrui(m, KLEAD, -1000),
        },
        () => [],
      );

      //  Lucchetti sempre rilasciati, anche con un errore a ogni passo, con DUE
      //  richieste insieme (due lead; lo stesso lead che tocca due volte). Un
      //  solo guasto per sequenza: o la chiamata fallisce prima di fare niente,
      //  o fa e poi lancia (la risposta si perde). Vedi anche il guasto a ogni
      //  passo di `prenota.mjs`, che però è una richiesta sola.
      const dueLead = [leadN(1), leadN(2)];
      const righeDue = await proposteDi({ consulenti: consFil, schede: dueLead }, [1, 2]);
      for (const [quale, schede, attori] of [
        [
          "due lead",
          dueLead,
          [
            { nome: "A", lead: 1 },
            { nome: "B", lead: 2 },
          ],
        ],
        [
          "stesso lead",
          [leadN(1)],
          [
            { nome: "A", lead: 1 },
            { nome: "B", lead: 1 },
          ],
        ],
      ]) {
        let giri = 0;
        const guai = [];
        for (const dopo of [false, true])
          for (let n = 1; n <= 75; n++) {
            const scenario = scenarioDa({
              consulenti: consFil,
              schede,
              righe: righeDue,
              attori,
              codici: ["prenotato", "preso", "errore", "tempo", "occupato", "gia_fissato"],
              avvisiAmmessi: true,
              prepara: (m) => {
                m.guasto = { al: n, dopo };
              },
              controlla: (ctx) => {
                const v = nonAMetà(
                  ctx,
                  attori.map((a) => [a.nome, a.lead]),
                );
                if (prenotati(ctx.esiti, ["A", "B"]).length > 1) v.push("due prenotazioni");
                return v;
              },
            });
            for (let seme = 1; seme <= 6; seme++) {
              const r = await corsa(scenario, aSeme(seme + n * 13));
              giri++;
              for (const viol of r.violazioni) {
                if (NOTI.D1.riconosci(viol)) continue;
                if (guai.length < 3)
                  guai.push(
                    `guasto ${dopo ? "dopo" : "prima"} al passo ${n}, seme ${seme} [${r.traccia}] → ${viol}`,
                  );
              }
            }
          }
        c(
          `6 · un guasto a ogni passo, ${quale} (${giri} sequenze): mai a metà, lucchetti rilasciati`,
          [],
          guai,
        );
      }
    }

    // ═══ 7. STESSO LEAD, DUE TOCCHI INSIEME ════════════════════════════════
    gruppo("PRENOTA · CONCORRENZA · STESSO LEAD, DUE TOCCHI INSIEME (T9.7)");
    {
      const righe = await proposteDi({ consulenti: consFil, schede: [leadN(1)] }, [1]);
      const SLOTS = [
        { g: "2026-10-27", o: "17:00" },
        { g: "2026-10-28", o: "17:00" },
        { g: "2026-10-29", o: "17:00" },
      ];
      //  Quante scritture della stanza fa UNA prenotazione sola: i tocchi doppi
      //  devono farne altrettante.
      const mRif = mondo({ consulenti: consFil, schede: [leadN(1)], righe });
      await vedi(mRif, corpoN(1, 2));
      const scrittureStanza = quanti(mRif, "stanza.scrivi");
      c(
        "(controllo del mondo) una prenotazione scrive almeno 4 righe della stanza",
        true,
        scrittureStanza >= 4,
      );

      for (const [a, b] of [
        [2, 2],
        [1, 2],
        [2, 3],
      ]) {
        const scenario = scenarioDa({
          consulenti: consFil,
          schede: [leadN(1)],
          righe,
          attori: [
            { nome: "A", lead: 1, scelta: a, slot: SLOTS[a - 1] },
            { nome: "B", lead: 1, scelta: b, slot: SLOTS[b - 1] },
          ],
          codici: ["prenotato", "occupato", "gia_fissato"],
          etichette: ({ esiti }) => {
            const t = [];
            for (const x of ["A", "B"])
              if (codice(esiti[x]) !== "prenotato") t.push(`l'altro dà «${codice(esiti[x])}»`);
            return t;
          },
          copertura: { "l'altro dà «occupato»": 3, "l'altro dà «gia_fissato»": 3 },
          controlla: ({ esiti, m }) => {
            const v = [];
            const vincitori = prenotati(esiti, ["A", "B"]);
            if (vincitori.length !== 1)
              v.push(`i vincitori sono ${vincitori.length}, deve essere 1`);
            const s = m.scheda(ID(1)).data;
            const scelto = SLOTS[(vincitori[0] === "A" ? a : b) - 1];
            if (s.dataMeeting !== scelto.g || s.oraMeeting !== scelto.o)
              v.push("la scheda non ha lo slot del vincitore");
            if (quanti(m, "scriviScheda", ID(1)) !== 1)
              v.push(
                `scritture della scheda: ${quanti(m, "scriviScheda", ID(1))}, doveva essere 1`,
              );
            if (quanti(m, "stanza.scrivi") !== scrittureStanza)
              v.push(
                `scritture della stanza: ${quanti(m, "stanza.scrivi")}, dovevano essere ${scrittureStanza}`,
              );
            if (quanti(m, "stanza.elimina") !== 0) v.push("ha tolto righe della stanza");
            if ((s.note.match(/Ha prenotato il cliente dalla chat/g) ?? []).length !== 1)
              v.push("la nota della prenotazione non è una sola");
            if (
              JSON.stringify(m.chiavi("meet:")) !==
              JSON.stringify([`meet:${ID(1)}`, `meet:${ID(1)}:c-fil`])
            )
              v.push(`righe meet: ${JSON.stringify(m.chiavi("meet:"))}`);
            if (m.chiavi("fascia:").length !== 1 || m.chiavi("attesi:").length !== 1)
              v.push("fascia o attesi non sono una riga");
            return v;
          },
        });
        await verifica(
          `7 · stesso lead, opzione ${a} e opzione ${b}`,
          scenario,
          a === b ? { cambi: [1, 2], max: 2500, semi: 120 } : { cambi: [1], max: 500, semi: 100 },
        );
      }
    }

    // ═══ 8. IL LUCCHETTO SCADE A METÀ ══════════════════════════════════════
    gruppo("PRENOTA · CONCORRENZA · IL LUCCHETTO SCADE A METÀ, DUE SCRIVONO INSIEME (T9.8)");
    {
      const righe = await proposteDi({ consulenti: consFil, schede: [leadN(1), leadN(2)] }, [1, 2]);
      const salto = (m) => () => m.avanza(SALTO_LUCCHETTO_MS);
      const base = {
        noti: ["D1", "D2"],
        consulenti: consFil,
        schede: [leadN(1), leadN(2)],
        righe,
        attori: [
          { nome: "A", lead: 1 },
          { nome: "B", lead: 2, ritardo: true },
          { nome: "E", tipo: "evento", fn: salto },
        ],
        codici: ["prenotato", "preso", "tempo"],
        avvisiAmmessi: true,
        etichette: ({ esiti, m }) => {
          const t = [];
          const n = prenotati(esiti, ["A", "B"]).length;
          if (["A", "B"].every((x) => codice(esiti[x]) === "preso"))
            t.push("due preso, zero prenotazioni");
          if (n === 1) t.push("uno solo prenota");
          if (m.guidaOk === true) t.push("guida riuscita");
          return t;
        },
        controlla: (ctx) => {
          const v = nonAMetà(ctx, [
            ["A", 1],
            ["B", 2],
          ]);
          if (prenotati(ctx.esiti, ["A", "B"]).length > 1)
            v.push("due prenotazioni sullo stesso slot");
          return v;
        },
      };
      await verifica("8 · salto dell'orologio ovunque", scenarioDa(base), {
        cambi: [1],
        max: 500,
        semi: 200,
      });

      //  Guidato, come nel PIANO: A ha il lucchetto, ha scritto la stanza e sta
      //  per scrivere la scheda; il lucchetto scade; B parte, lo prende, rilegge
      //  l'agenda (A non ha ancora scritto), scrive la sua stanza e sta per
      //  scrivere la scheda. Poi si lascia fare tutto il resto in ogni ordine:
      //  possono scrivere tutti e due. Qualunque sia l'ordine, DUE prenotazioni
      //  mai; e quando entrambi vedono l'altro entrambi disfano.
      const guidato = scenarioDa({
        ...base,
        attori: base.attori.map((a) => (a.nome === "B" ? { ...a, ritardo: true } : a)),
        codici: ["prenotato", "preso"],
        guida: async (regia, m) => {
          await regia.finoA("A", { prima: "scriviScheda" });
          await regia.via("E");
          await regia.finoA("B", { prima: "scriviScheda" });
          m.guidaOk = ["A", "B"].every((x) =>
            regia.attore(x).pendenti.some((p) => p.nome === "scriviScheda"),
          );
        },
        copertura: {
          "guida riuscita": 1,
          "due preso, zero prenotazioni": 1,
          "uno solo prenota": 1,
        },
        controlla: (ctx) => {
          const v = base.controlla(ctx);
          if (ctx.m.guidaOk !== true)
            v.push("la guida non è arrivata al punto (A e B fermi su scriviScheda)");
          return v;
        },
      });
      await verifica("8 · entrambi stanno per scrivere la scheda", guidato, {
        cambi: [1, 2, 3],
        max: 3000,
        semi: 100,
      });
    }

    // ═══ 9. TRE LEAD, DUE CONSULENTI ═══════════════════════════════════════
    gruppo("PRENOTA · CONCORRENZA · TRE LEAD, DUE CONSULENTI, UNO SLOT");
    {
      const tre = [leadN(1), leadN(2), leadN(3)];
      const righe = await proposteDi({ consulenti: consFilBea, schede: tre }, [1, 2, 3]);
      const scenario = scenarioDa({
        consulenti: consFilBea,
        schede: tre,
        righe,
        attori: [
          { nome: "A", lead: 1 },
          { nome: "B", lead: 2 },
          { nome: "C", lead: 3 },
        ],
        codici: ["prenotato", "preso"],
        etichette: ({ esiti }) => {
          const escluso = ["A", "B", "C"].find((x) => codice(esiti[x]) === "preso");
          return escluso ? [`resta fuori ${escluso}`] : [];
        },
        copertura: { "resta fuori A": 5, "resta fuori B": 5, "resta fuori C": 5 },
        controlla: ({ esiti, m }) => {
          const v = [];
          const dentro = prenotati(esiti, ["A", "B", "C"]);
          if (dentro.length !== 2)
            v.push(`le prenotazioni sono ${dentro.length}, devono essere 2 (due consulenti)`);
          const cons = dentro.map((x) => m.scheda(ID({ A: 1, B: 2, C: 3 }[x])).data.consulenteId);
          if (new Set(cons).size !== cons.length) v.push("due prenotati con lo stesso consulente");
          return v;
        },
      });
      await verifica("9 · tre lead, Filippo e Bea", scenario, { cambi: [1], max: 3000, semi: 400 });
    }
  } finally {
    globalThis.fetch = fetchVero;
    delete subtle.importKey;
    delete subtle.sign;
  }
  c("nessuna chiamata fuori dal database", 0, chiamateEsterne);
}
