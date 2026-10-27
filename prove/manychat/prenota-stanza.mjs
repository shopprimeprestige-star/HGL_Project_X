/** ── PROVE: LA STANZA E IL LINK (T5) ─────────────────────────────────────
 *
 *  Commessa 2026-10-27 (prenota in chat), compito T5. `assicuraStanza`
 *  (`prenota-stanza.ts`) rifà quello che fa `api.crm.meeting-session` per un
 *  appuntamento, ma dal server e senza toccare la rotta del browser. Si prova
 *  con un `app_config` finto (una Map) che conta le scritture e può rompersi
 *  a comando; la parità con la rotta si prova sulle chiavi, con le STESSE
 *  funzioni che la rotta importa.
 *
 *  Dati inventati: nessun nome né numero vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { deepStrictEqual } from "node:assert";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSync } from "esbuild";

/** Impacchetta un modulo `.ts` in una cartella temporanea e lo carica (come
 *  fa `pannello.mjs`): `lib/sito` non è nell'elenco di `prove.mjs`. */
function carica(radice, relativo) {
  const dove = mkdtempSync(join(tmpdir(), "stanza-"));
  try {
    const fuori = join(dove, "modulo.cjs");
    buildSync({
      entryPoints: [join(radice, relativo)],
      bundle: true,
      format: "cjs",
      outfile: fuori,
      alias: { "@": join(radice, "src") },
      logLevel: "error",
    });
    return createRequire(import.meta.url)(fuori);
  } finally {
    rmSync(dove, { recursive: true, force: true });
  }
}

const identiche = (a, b) => {
  try {
    deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
};

/** `app_config` finto: una Map, il registro delle scritture, e un guasto a comando. */
function mondo(iniziale = {}) {
  const righe = new Map(Object.entries(iniziale));
  const registro = [];
  let guasto = null;
  const rompi = (op, chiave) => {
    if (guasto && guasto(op, chiave)) throw { code: "guasto_finto" };
  };
  return {
    righe,
    registro,
    rompiSe: (f) => {
      guasto = f;
    },
    porte: {
      async leggi(chiave) {
        rompi("leggi", chiave);
        return righe.has(chiave) ? righe.get(chiave) : null;
      },
      async scrivi(chiave, valore) {
        rompi("scrivi", chiave);
        righe.set(chiave, valore);
        registro.push(["scrivi", chiave]);
      },
      async elimina(chiave) {
        rompi("elimina", chiave);
        righe.delete(chiave);
        registro.push(["elimina", chiave]);
      },
    },
  };
}
/** Come sta `app_config`, per i confronti prima/dopo. */
const foto = (m) => [...m.righe].sort(([a], [b]) => (a < b ? -1 : 1));

export async function proveDellaStanzaPrenota(mod, { c, gruppo, radice }) {
  const S = mod["manychat/prenota-stanza"];
  const STZ = mod["stanza-consulenza"];
  const FAS = mod["fascia-consulenza"];
  const SITO = carica(radice, "src/lib/sito.ts");

  const ADESSO = new Date("2026-10-27T14:42:00Z");
  const ISO = ADESSO.toISOString();
  const LEAD = "11111111-1111-4111-8111-111111111111";
  const ALTRO = "22222222-2222-4222-8222-222222222222";
  const CID = "cons-filippo";
  const IN = {
    leadId: LEAD,
    nome: "Anna",
    cognome: "Demo",
    consulenteId: CID,
    giorno: "2026-10-29",
    ora: "18:00",
    durata: 60,
    adesso: ADESSO,
  };
  const FORMA = /^[bcdfghjkmnpqrstvwxyz]{3}-[bcdfghjkmnpqrstvwxyz]{4}-[bcdfghjkmnpqrstvwxyz]{3}$/;
  const K_STORICA = `meet:${LEAD}`;
  const K_COPPIA = `meet:${LEAD}:${CID}`;
  const K_FASCIA = `fascia:${CID}:2026-10-29T18:00`;
  const sessione = (code, extra = {}) =>
    JSON.stringify({
      code,
      leadId: LEAD,
      consultantId: CID,
      quando: "2026-10-29T18:00",
      durata: 60,
      createdAt: "2026-10-20T09:00:00.000Z",
      ...extra,
    });
  const json = (m, k) => JSON.parse(m.righe.get(k));

  // `fetch` è un allarme: la stanza vive in `app_config`, non chiama nessuno.
  const fetchVero = globalThis.fetch;
  let chiamateFetch = 0;
  globalThis.fetch = () => {
    chiamateFetch++;
    throw new Error("fetch vietato in assicuraStanza");
  };

  try {
    // ── (a) lead senza stanza ─────────────────────────────────────────────
    gruppo("PRENOTA · STANZA · LEAD SENZA STANZA");
    {
      const m = mondo();
      const r = await S.assicuraStanza(m.porte, IN);
      c("codice nuovo, forma xxx-xxxx-xxx", true, FORMA.test(r.code));
      c("nuova", true, r.nuova);
      c("quattro righe: storica, coppia, fascia, attesi", [K_FASCIA, `attesi:${r.code}`, K_STORICA, K_COPPIA].sort(), [...m.righe.keys()].sort());
      const att = {
        code: r.code,
        leadId: LEAD,
        consultantId: CID,
        quando: "2026-10-29T18:00",
        durata: 60,
        createdAt: ISO,
      };
      c("meet:<lead> = sessione (stessi campi della rotta)", att, json(m, K_STORICA));
      c("meet:<lead>:<consulente> = la stessa", att, json(m, K_COPPIA));
      c("l'ordine dei campi è quello della rotta", '{"code":"' + r.code + '","leadId":"' + LEAD + '","consultantId":"' + CID + '","quando":"2026-10-29T18:00","durata":60,"createdAt":"' + ISO + '"}', m.righe.get(K_STORICA));
      c("fascia = { code, il }", { code: r.code, il: ISO }, json(m, K_FASCIA));
      c("attesi = la persona, con nome e cognome", { persone: [{ leadId: LEAD, nome: "Anna", cognome: "Demo" }] }, json(m, `attesi:${r.code}`));
      c("ordine di scrittura: stanza, copia, fascia, attesi", [K_STORICA, K_COPPIA, K_FASCIA, `attesi:${r.code}`], m.registro.map((x) => x[1]));
      c("il link è quello di urlStanza", SITO.urlStanza(r.code), r.link);
      c("il link ha il dominio pubblico e /meetly/", `${SITO.SITO}/meetly/${r.code}`, r.link);
      c("nessun fetch", 0, chiamateFetch);
    }
    {
      const m = mondo();
      const r = await S.assicuraStanza(m.porte, { ...IN, nome: undefined, cognome: undefined });
      c("senza nome: «Cliente», senza cognome", { persone: [{ leadId: LEAD, nome: "Cliente" }] }, json(m, `attesi:${r.code}`));
    }
    {
      const m = mondo();
      const r = await S.assicuraStanza(m.porte, { ...IN, ora: "9:05" });
      c("ora «9:05» → fascia alle 09:05", true, m.righe.has(`fascia:${CID}:2026-10-29T09:05`));
      c("…e la sessione porta «T09:05»", "2026-10-29T09:05", json(m, K_STORICA).quando);
      c("…e il codice è valido", true, FORMA.test(r.code));
    }
    {
      // La forma del codice, su molti codici veri (alfabeto senza vocali né lettere ambigue).
      const visti = new Set();
      let tutteBuone = true;
      for (let i = 0; i < 300; i++) {
        const r = await S.assicuraStanza(mondo().porte, IN);
        visti.add(r.code);
        if (!FORMA.test(r.code)) tutteBuone = false;
      }
      c("300 codici: tutti nella forma giusta", true, tutteBuone);
      c("300 codici: praticamente tutti diversi (≥ 299)", true, visti.size >= 299);
    }

    // ── (b) lead con stanza ───────────────────────────────────────────────
    gruppo("PRENOTA · STANZA · LEAD CHE HA GIÀ LA STANZA (il link partito vince)");
    {
      const m = mondo({ [K_STORICA]: sessione("bbb-bbbb-ccc"), [K_COPPIA]: sessione("bbb-bbbb-ccc") });
      const prima = foto(m);
      const r = await S.assicuraStanza(m.porte, IN);
      c("stesso codice", "bbb-bbbb-ccc", r.code);
      c("stesso link", SITO.urlStanza("bbb-bbbb-ccc"), r.link);
      c("non è nuova", false, r.nuova);
      c("le righe meet: non si riscrivono (identiche)", true, identiche(
        [m.righe.get(K_STORICA), m.righe.get(K_COPPIA)], [sessione("bbb-bbbb-ccc"), sessione("bbb-bbbb-ccc")]));
      c("scritte solo fascia e attesi", [K_FASCIA, "attesi:bbb-bbbb-ccc"], m.registro.map((x) => x[1]));
      c("la fascia porta il codice del lead", "bbb-bbbb-ccc", json(m, K_FASCIA).code);
      c("(controllo: prima non c'erano)", 2, prima.length);
    }
    {
      // Solo la copia per consulente (la storica è sparita): si riusa e si ripristina la storica.
      const m = mondo({ [K_COPPIA]: sessione("ccc-cccc-ccc") });
      const r = await S.assicuraStanza(m.porte, IN);
      c("solo la copia: si riusa il suo codice", "ccc-cccc-ccc", r.code);
      c("…e non è nuova", false, r.nuova);
      c("…e la storica torna a esserci, con lo stesso codice", "ccc-cccc-ccc", json(m, K_STORICA).code);
    }
    {
      // La stanza di un lead con un appuntamento vecchio: stesso codice, orario nuovo, createdAt vecchio.
      const m = mondo({
        [K_STORICA]: sessione("ddd-dddd-ddd", { quando: "2026-10-12T17:00", durata: 45, consultantId: "cons-altro" }),
      });
      const r = await S.assicuraStanza(m.porte, IN);
      c("appuntamento vecchio: stesso codice", "ddd-dddd-ddd", r.code);
      c("…orario nuovo nella sessione", "2026-10-29T18:00|60|cons-filippo|2026-10-20T09:00:00.000Z",
        (({ quando, durata, consultantId, createdAt }) => [quando, durata, consultantId, createdAt].join("|"))(json(m, K_STORICA)));
      c("…e la copia del nuovo consulente", "ddd-dddd-ddd", json(m, K_COPPIA).code);
    }
    {
      // La storica è illeggibile: come per la rotta, non c'è.
      const m = mondo({ [K_STORICA]: "{non è json" });
      const r = await S.assicuraStanza(m.porte, IN);
      c("storica illeggibile: codice nuovo", true, r.nuova && FORMA.test(r.code));
      await r.annulla();
      c("…e annulla rimette la riga illeggibile com'era", "{non è json", m.righe.get(K_STORICA));
    }

    // ── (c) la fascia: codice nuovo, modo conservato ──────────────────────
    gruppo("PRENOTA · STANZA · LA FASCIA (D4: codice nuovo, `modo` conservato)");
    {
      const m = mondo({ [K_FASCIA]: JSON.stringify({ code: "xxx-xxxx-xxx", il: "2026-10-01T10:00:00.000Z", modo: "solo" }) });
      const r = await S.assicuraStanza(m.porte, IN);
      c("fascia vecchia di un altro: codice NUOVO, non il suo", true, r.nuova && r.code !== "xxx-xxxx-xxx");
      const f = json(m, K_FASCIA);
      c("la fascia ora punta alla stanza del lead", r.code, f.code);
      c("«solo» conservato", "solo", f.modo);
      c("il momento è aggiornato", ISO, f.il);
      c("leggiModoFascia lo legge", "solo", FAS.leggiModoFascia(m.righe.get(K_FASCIA)));
    }
    {
      const m = mondo({ [K_FASCIA]: JSON.stringify({ code: "xxx-xxxx-xxx", modo: "aperta" }) });
      await S.assicuraStanza(m.porte, IN);
      c("«aperta» scritta resta «aperta»", "aperta", json(m, K_FASCIA).modo);
    }
    {
      const m = mondo({ [K_FASCIA]: JSON.stringify({ code: "xxx-xxxx-xxx" }) });
      await S.assicuraStanza(m.porte, IN);
      c("senza modo: non se ne inventa uno", false, "modo" in json(m, K_FASCIA));
    }
    {
      const m = mondo({ [K_FASCIA]: "rotta{" });
      const r = await S.assicuraStanza(m.porte, IN);
      c("fascia illeggibile: si riscrive pulita", { code: r.code, il: ISO }, json(m, K_FASCIA));
    }
    {
      // Un altro lead, stessa fascia, già con la sua stanza: il suo link non cambia, la fascia segue l'ultimo.
      const m = mondo({
        [`meet:${ALTRO}`]: sessione("eee-eeee-eee", { leadId: ALTRO }),
        [K_FASCIA]: JSON.stringify({ code: "eee-eeee-eee", il: "2026-10-27T09:00:00.000Z" }),
      });
      const r = await S.assicuraStanza(m.porte, IN);
      c("altro lead nella fascia: la sua stanza resta", "eee-eeee-eee", json(m, `meet:${ALTRO}`).code);
      c("il nuovo lead ha una stanza sua", true, r.nuova && r.code !== "eee-eeee-eee");
    }
    {
      // Gli attesi: la lista della stanza si arricchisce senza doppioni e senza perdere nessuno.
      const m = mondo({
        [K_STORICA]: sessione("fff-ffff-fff"),
        "attesi:fff-ffff-fff": JSON.stringify({ persone: [{ leadId: ALTRO, nome: "Bruno", cognome: "Demo" }] }),
      });
      await S.assicuraStanza(m.porte, IN);
      await S.assicuraStanza(m.porte, IN);
      c("attesi: l'altro resta, il lead si aggiunge una volta sola", [
        { leadId: ALTRO, nome: "Bruno", cognome: "Demo" },
        { leadId: LEAD, nome: "Anna", cognome: "Demo" },
      ], json(m, "attesi:fff-ffff-fff").persone);
    }

    // ── (d) parità con la rotta ───────────────────────────────────────────
    gruppo("PRENOTA · STANZA · PARITÀ CON api.crm.meeting-session (stesse chiavi)");
    {
      const tzPrima = process.env.TZ;
      try {
        // Sul Worker il fuso è UTC: `chiaveFascia` della rotta legge «2026-10-29T18:00» come UTC.
        process.env.TZ = "UTC";
        c("il fuso UTC è applicato (altrimenti la parità non vale)", "2026-10-29T18:00:00.000Z", new Date("2026-10-29T18:00").toISOString());
        const m = mondo();
        const r = await S.assicuraStanza(m.porte, IN);
        const chiavi = [...m.righe.keys()].sort();
        const dellaRotta = [
          STZ.chiaveStanzaStorica(LEAD),
          STZ.chiaveStanza(LEAD, CID),
          FAS.chiaveFascia(CID, "2026-10-29T18:00"),
          FAS.chiaveAttesi(r.code),
        ].sort();
        c("le chiavi sono quelle di chiaveStanza/Storica/Fascia/Attesi", dellaRotta, chiavi);
        // consulente con maiuscole e segni: la chiave fascia li pulisce come la rotta.
        const m2 = mondo();
        await S.assicuraStanza(m2.porte, { ...IN, consulenteId: "Cons_Filippo.01" });
        c("consulenteId sporco: stessa pulizia della rotta", FAS.chiaveFascia("Cons_Filippo.01", "2026-10-29T18:00"),
          [...m2.righe.keys()].find((k) => k.startsWith("fascia:")));
        c("…e la coppia usa l'id com'è (come la rotta)", true, m2.righe.has(STZ.chiaveStanza(LEAD, "Cons_Filippo.01")));
        // Fuso diverso: la nostra chiave NON cambia (la costruisce dalla stringa), quella della rotta sì.
        process.env.TZ = "America/Los_Angeles";
        const m3 = mondo();
        await S.assicuraStanza(m3.porte, IN);
        c("con un altro fuso la nostra chiave fascia è la stessa", K_FASCIA, [...m3.righe.keys()].find((k) => k.startsWith("fascia:")));
        c("(…mentre la chiave della rotta, calcolata in locale, slitterebbe)", true, FAS.chiaveFascia(CID, "2026-10-29T18:00") !== K_FASCIA);
        process.env.TZ = "Europe/Rome";
        const m4 = mondo();
        await S.assicuraStanza(m4.porte, IN);
        c("a Roma, stessa chiave", K_FASCIA, [...m4.righe.keys()].find((k) => k.startsWith("fascia:")));
      } finally {
        if (tzPrima === undefined) delete process.env.TZ;
        else process.env.TZ = tzPrima;
      }
    }
    {
      // La rotta non si tocca: il file è quello e ha le funzioni che ci aspettiamo.
      const rotta = readFileSync(join(radice, "src/routes/api.crm.meeting-session.ts"), "utf8");
      c("la rotta usa chiaveStanza/chiaveStanzaStorica", true, /chiaveStanza,\s*chiaveStanzaStorica/.test(rotta));
      c("la rotta usa chiaveFascia, chiaveAttesi, unisciAttesi", true, /chiaveAttesi,\s*chiaveFascia,\s*leggiAttesi,\s*scriviAttesi,\s*unisciAttesi/.test(rotta));
      c("la rotta scrive sessione con questi campi", true, /code,\s*leadId,\s*consultantId:[\s\S]*quando:[\s\S]*durata:[\s\S]*createdAt:/.test(rotta));
      c("la rotta usa lo stesso alfabeto", true, rotta.includes('"bcdfghjkmnpqrstvwxyz"'));
      c("la rotta fa gruppi 3-4-3", true, rotta.includes("${gruppo(3)}-${gruppo(4)}-${gruppo(3)}"));
      c("il modulo nuovo non importa la rotta", false, /api\.crm\.meeting-session/.test(
        readFileSync(join(radice, "src/crm/manychat/prenota-stanza.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1")));
    }

    // ── (g) errori ────────────────────────────────────────────────────────
    gruppo("PRENOTA · STANZA · ERRORI (la stanza sì, gli attesi no)");
    {
      const m = mondo({ altra: "riga" });
      const prima = foto(m);
      m.rompiSe((op, k) => op === "scrivi" && k === K_STORICA);
      let lanciato = null;
      try {
        await S.assicuraStanza(m.porte, IN);
      } catch (e) {
        lanciato = e;
      }
      c("errore sulla riga della stanza: lancia", { code: "guasto_finto" }, lanciato);
      c("…nessuna riga fascia scritta", false, m.righe.has(K_FASCIA));
      c("…nessuna riga attesi scritta", false, [...m.righe.keys()].some((k) => k.startsWith("attesi:")));
      c("…app_config com'era", prima, foto(m));
    }
    {
      const m = mondo();
      m.rompiSe((op, k) => op === "scrivi" && k === K_COPPIA);
      let lanciato = false;
      try {
        await S.assicuraStanza(m.porte, IN);
      } catch {
        lanciato = true;
      }
      c("errore sulla copia: lancia", true, lanciato);
      c("…la riga storica già scritta viene tolta", [], foto(m));
    }
    {
      const m = mondo({ [K_FASCIA]: JSON.stringify({ code: "xxx-xxxx-xxx", modo: "solo" }) });
      const prima = foto(m);
      m.rompiSe((op, k) => op === "scrivi" && k === K_FASCIA);
      let lanciato = false;
      try {
        await S.assicuraStanza(m.porte, IN);
      } catch {
        lanciato = true;
      }
      c("errore sulla fascia: lancia", true, lanciato);
      c("…le righe della stanza già scritte vengono tolte", prima, foto(m));
    }
    {
      const m = mondo();
      m.rompiSe((op, k) => k.startsWith("attesi:"));
      const r = await S.assicuraStanza(m.porte, IN);
      c("errore sugli attesi: NON fa fallire", true, FORMA.test(r.code));
      c("…la stanza e la fascia ci sono", [K_FASCIA, K_STORICA, K_COPPIA].sort(), [...m.righe.keys()].sort());
      m.rompiSe(null);
      await r.annulla();
      c("…e annulla toglie quello che c'è", [], foto(m));
    }
    {
      // Errore in LETTURA di una riga della stanza: lancia, niente scritto.
      const m = mondo();
      m.rompiSe((op, k) => op === "leggi" && k === K_STORICA);
      let lanciato = false;
      try {
        await S.assicuraStanza(m.porte, IN);
      } catch {
        lanciato = true;
      }
      c("errore nel leggere la stanza: lancia", true, lanciato);
      c("…e non scrive niente", 0, m.registro.length);
    }
    for (const [nome, cambio] of [
      ["giorno impossibile", { giorno: "2026-02-30" }],
      ["giorno scritto all'italiana", { giorno: "29/10/2026" }],
      ["ora impossibile", { ora: "25:00" }],
      ["ora vuota", { ora: "" }],
      ["lead senza id", { leadId: "  " }],
      ["consulente senza id", { consulenteId: "" }],
    ]) {
      const m = mondo();
      let lanciato = false;
      try {
        await S.assicuraStanza(m.porte, { ...IN, ...cambio });
      } catch {
        lanciato = true;
      }
      c(`${nome}: lancia e non scrive`, "true|0", `${lanciato}|${m.registro.length}`);
    }

    // ── (i) annulla ───────────────────────────────────────────────────────
    gruppo("PRENOTA · STANZA · annulla() RIMETTE TUTTO COM'ERA");
    {
      const m = mondo({ "altra:chiave": "valore", "attesi:zzz-zzzz-zzz": "{}" });
      const prima = foto(m);
      const r = await S.assicuraStanza(m.porte, IN);
      c("dopo la stanza nuova app_config è cambiato", false, identiche(prima, foto(m)));
      await r.annulla();
      c("stanza nuova + annulla: app_config IDENTICO (profondo)", true, identiche(prima, foto(m)));
      await r.annulla();
      c("annulla due volte: nessun danno", true, identiche(prima, foto(m)));
    }
    {
      const m = mondo({
        [K_STORICA]: sessione("ggg-gggg-ggg"),
        [K_COPPIA]: sessione("ggg-gggg-ggg"),
        [K_FASCIA]: JSON.stringify({ code: "xxx-xxxx-xxx", modo: "solo" }),
        "attesi:ggg-gggg-ggg": JSON.stringify({ persone: [{ leadId: ALTRO, nome: "Bruno" }] }),
      });
      const prima = foto(m);
      const r = await S.assicuraStanza(m.porte, IN);
      c("stanza riusata: la fascia cambia", false, m.righe.get(K_FASCIA) === prima.find(([k]) => k === K_FASCIA)[1]);
      await r.annulla();
      c("stanza riusata + annulla: app_config IDENTICO", true, identiche(prima, foto(m)));
      c("(le righe meet: non erano state toccate)", 0, m.registro.filter(([op, k]) => op === "scrivi" && k.startsWith("meet:")).length);
    }
    {
      // Una riga che non si riesce a rimettere: le altre si rimettono, annulla lancia, riprovando si finisce.
      const m = mondo({ x: "1" });
      const prima = foto(m);
      const r = await S.assicuraStanza(m.porte, IN);
      m.rompiSe((op, k) => op === "elimina" && k === K_COPPIA);
      let lanciato = false;
      try {
        await r.annulla();
      } catch {
        lanciato = true;
      }
      c("annulla con un guasto: lancia", true, lanciato);
      c("…ma le altre righe sono tornate (resta solo la copia)", [["x", "1"], [K_COPPIA, m.righe.get(K_COPPIA)]].sort(([a], [b]) => (a < b ? -1 : 1)), foto(m));
      m.rompiSe(null);
      await r.annulla();
      c("…riprovando, tutto com'era", true, identiche(prima, foto(m)));
    }
    {
      // Il registro ricorda il valore di PRIMA di ogni scrittura, anche quando una riga viene scritta due volte.
      const m = mondo();
      const r1 = await S.assicuraStanza(m.porte, IN);
      const dopoPrima = foto(m);
      const r2 = await S.assicuraStanza(m.porte, { ...IN, ora: "19:00" });
      c("una seconda chiamata (altra ora) sullo stesso lead riusa il codice", r1.code, r2.code);
      await r2.annulla();
      c("annullare la seconda non toglie la prima", true, identiche(dopoPrima, foto(m)));
    }

    // ── (j) due chiamate di fila ──────────────────────────────────────────
    gruppo("PRENOTA · STANZA · DUE CHIAMATE DI FILA PER LO STESSO LEAD");
    {
      const m = mondo();
      const r1 = await S.assicuraStanza(m.porte, IN);
      const scrittureDopoLaPrima = m.registro.length;
      const r2 = await S.assicuraStanza(m.porte, IN);
      c("stesso codice", r1.code, r2.code);
      c("stesso link", r1.link, r2.link);
      c("la seconda non è nuova", false, r2.nuova);
      c("la seconda NON riscrive meet:<lead> né la copia", [], m.registro.slice(scrittureDopoLaPrima).filter(([, k]) => k.startsWith("meet:")));
      c("(la prima sì: l'aveva scritta una volta)", 1, m.registro.filter(([, k]) => k === K_STORICA).length);
      c("la seconda non lascia righe in più", 4, m.righe.size);
      c("un solo atteso, il lead", 1, json(m, `attesi:${r1.code}`).persone.length);
      // …e se la seconda annulla, la prima resta.
      const dopo = foto(m);
      await r2.annulla();
      c("annullare la seconda lascia intatta la stanza", true, identiche(dopo, foto(m)));
    }
    {
      // Due lead diversi nella stessa ora (la setter può farlo dal browser): due stanze, ognuno la sua.
      const m = mondo();
      const r1 = await S.assicuraStanza(m.porte, IN);
      const r2 = await S.assicuraStanza(m.porte, { ...IN, leadId: ALTRO, nome: "Bruno", cognome: "Prova" });
      c("due lead nella stessa ora: due codici diversi", true, r1.code !== r2.code);
      c("…ognuno con la sua stanza storica", [r1.code, r2.code], [json(m, K_STORICA).code, json(m, `meet:${ALTRO}`).code]);
    }

    c("in tutto il file: nessun fetch", 0, chiamateFetch);
  } finally {
    globalThis.fetch = fetchVero;
  }

  gruppo("PRENOTA · STANZA · MODULO");
  {
    const src = readFileSync(join(radice, "src/crm/manychat/prenota-stanza.ts"), "utf8");
    const codice = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
    c("nessun fetch nel sorgente", false, /\bfetch\s*\(/.test(codice));
    c("nessun database: lavora solo sulla porta", false, /supabase/i.test(codice));
    c("nessun orologio nascosto", false, /new Date\(\s*\)|Date\.now\(/.test(codice));
    c("nessun console.log", false, /console\./.test(codice));
    c("il codice viene da crypto.getRandomValues", true, /crypto\.getRandomValues/.test(codice));
    c("nessun Math.random", false, /Math\.random/.test(codice));
  }
}
