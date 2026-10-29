import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSync } from "esbuild";

/** Impacchetta un modulo puro in una cartella temporanea e lo carica (come casi-reali.mjs):
 *  così questo pacchetto non tocca l'elenco MODULI di prove.mjs. */
function carica(radice, relativo) {
  const dove = mkdtempSync(join(tmpdir(), "consulenze-"));
  try {
    const fuori = join(dove, "modulo.cjs");
    buildSync({
      entryPoints: [join(radice, relativo)],
      bundle: true,
      format: "cjs",
      outfile: fuori,
      alias: { "@": join(radice, "src") },
      loader: { ".tsx": "tsx" },
      logLevel: "error",
    });
    return createRequire(import.meta.url)(fuori);
  } finally {
    rmSync(dove, { recursive: true, force: true });
  }
}

/** ── PROVE: CONFERMA A DUE PASSI E ASSENZA ALLA CONSULENZA ──────────────────
 *
 *  Commessa 2026-10-30 (ottimizzazioni), pacchetto p5-consulenze.
 *   (10) promemoria della consulenza senza risposta da 3 ore → in cima a «Da fare»
 *        del consulente, prima dell'inizio;
 *   (12) 15' dopo l'inizio nessuno in stanza Meetly → «Da riprogrammare» in
 *        automatico, e il messaggio dello stato parte subito (non dopo 30').
 *  Dati inventati. Consulenza venerdì 30/10/2026 alle 15:00 di Roma (+01:00). */
export async function proveConsulenze(mod, { c, gruppo, radice }) {
  const K = carica(radice, "src/crm/manychat/consulenze.ts");
  const DF = carica(radice, "src/crm/dafare/righe.tsx");
  const T = mod["manychat/stati"];

  const t = (iso) => new Date(iso);
  const voce = (stato, il, motivo, da = "automatico") => ({ stato, il, da, ...(motivo ? { motivo } : {}) });
  /** la storia si scrive con la voce nuova in testa: qui si passa in ordine di tempo */
  const cw = (...voci) => {
    const storia = [...voci].reverse();
    const ultima = storia[0];
    return { stato: ultima.stato, il: ultima.il, da: ultima.da, motivo: ultima.motivo, storia };
  };
  const scheda = (extra) => ({
    nome: "Anna",
    cognome: "Prova",
    telefono: "333 000 0001",
    stato: "appuntamento_fissato",
    consulenteId: "cons-1",
    dataMeeting: "2026-10-30",
    oraMeeting: "15:00",
    linkMeeting: "https://hairgeniuslabs.com/meetly/abc-defg-hij",
    ...extra,
  });
  const DOMANI_INV = "2026-10-29T14:00:00.000Z"; // giovedì 15:00 di Roma
  const OGGI_INV = "2026-10-30T08:00:00.000Z"; // venerdì 9:00 di Roma

  gruppo("CONSULENZE · (10) CONFERMA A DUE PASSI");
  {
    const d = scheda({ contattoWa: cw(voce("in_attesa", DOMANI_INV, "meet_domani")) });
    c("promemoria del giorno prima senza risposta da 3 ore: va chiamato", true,
      !!K.confermaMancata(d, t("2026-10-29T17:00:00.000Z")));
    c("…non prima delle 3 ore", null, K.confermaMancata(d, t("2026-10-29T16:59:00.000Z")));
    c("…e dice da quando aspetta e quando inizia", [DOMANI_INV, "2026-10-30T14:00:00.000Z"],
      (() => {
        const m = K.confermaMancata(d, t("2026-10-30T10:00:00.000Z"));
        return [m.promemoriaIl.toISOString(), m.inizio.toISOString()];
      })());
    c("a consulenza iniziata non serve più", null, K.confermaMancata(d, t("2026-10-30T14:00:00.000Z")));

    const risposto = scheda({
      contattoWa: cw(voce("in_attesa", DOMANI_INV, "meet_domani"), voce("ha_risposto", "2026-10-29T15:00:00.000Z")),
    });
    c("ha risposto: confermata, niente", null, K.confermaMancata(risposto, t("2026-10-30T10:00:00.000Z")));

    //  Una risposta al giorno prima, poi la mattina senza risposta: ha già confermato una volta.
    const rispostoPoiMattina = scheda({
      contattoWa: cw(
        voce("in_attesa", DOMANI_INV, "meet_domani"),
        voce("ha_risposto", "2026-10-29T15:00:00.000Z"),
        voce("in_attesa", OGGI_INV, "meet_oggi"),
      ),
    });
    c("risposto al giorno prima, la mattina tace: niente", null,
      K.confermaMancata(rispostoPoiMattina, t("2026-10-30T12:00:00.000Z")));

    const aMano = scheda({
      contattoWa: cw(voce("in_attesa", DOMANI_INV, "meet_domani"), voce("contattato", "2026-10-29T16:00:00.000Z", undefined, "Filippo Demo")),
    });
    c("cambiato a mano dopo il promemoria (l'ha sentito il consulente): niente", null,
      K.confermaMancata(aMano, t("2026-10-30T10:00:00.000Z")));

    //  Il giorno prima è spento dal 28/10: vale anche il messaggio della mattina.
    const mattina = scheda({ contattoWa: cw(voce("in_attesa", OGGI_INV, "meet_oggi")) });
    c("messaggio della mattina senza risposta da 3 ore: va chiamato", true,
      !!K.confermaMancata(mattina, t("2026-10-30T11:00:00.000Z")));
    c("…non prima", null, K.confermaMancata(mattina, t("2026-10-30T10:59:00.000Z")));

    //  Tutti e due senza risposta: conta il primo (aspetta da giovedì).
    const tutti = scheda({
      contattoWa: cw(voce("in_attesa", DOMANI_INV, "meet_domani"), voce("in_attesa", OGGI_INV, "meet_oggi")),
    });
    c("giorno prima e mattina senza risposta: conta il primo", DOMANI_INV,
      K.confermaMancata(tutti, t("2026-10-30T09:00:00.000Z"))?.promemoriaIl.toISOString());

    //  Un promemoria di un'altra consulenza (la data è stata spostata) non conta.
    const vecchio = scheda({ contattoWa: cw(voce("in_attesa", "2026-10-26T14:00:00.000Z", "meet_domani")) });
    c("promemoria di una consulenza di prima: niente", null,
      K.confermaMancata(vecchio, t("2026-10-30T10:00:00.000Z")));
    c("senza appuntamento: niente", null,
      K.confermaMancata({ ...d, stato: "da_spostare" }, t("2026-10-30T10:00:00.000Z")));
    c("altri messaggi automatici (non promemoria): niente", null,
      K.confermaMancata(scheda({ contattoWa: cw(voce("in_attesa", DOMANI_INV, "ricontatto")) }), t("2026-10-30T10:00:00.000Z")));
    c("STOP: niente", null,
      K.confermaMancata(scheda({ contattoWa: cw(voce("in_attesa", DOMANI_INV, "meet_domani"), voce("stop", "2026-10-29T15:00:00.000Z", "stop")) }), t("2026-10-30T10:00:00.000Z")));
  }

  gruppo("CONSULENZE · (10) IN CIMA A «DA FARE»");
  {
    const lead = (id, extra) => ({ id, data: scheda(extra) });
    const daConfermare = lead("l-1", { contattoWa: cw(voce("in_attesa", OGGI_INV, "meet_oggi")) });
    const confermato = lead("l-2", { contattoWa: cw(voce("in_attesa", OGGI_INV, "meet_oggi"), voce("ha_risposto", "2026-10-30T08:30:00.000Z")) });
    const ricontatto = lead("l-3", { stato: "da_ricontattare", dataRicontatto: "2026-10-30", oraRicontatto: "11:30", contattoWa: undefined });
    const ora = t("2026-10-30T11:00:00.000Z"); // 12:00 di Roma
    const righe = DF.costruisciRighe({ leads: [ricontatto, confermato, daConfermare], task: [], ora });
    const r = righe.find((x) => x.id === "lead:l-1");
    c("la consulenza da confermare entra nella giornata", "conferma_meet", r?.tipo);
    c("l'appuntamento confermato resta fuori (ha la sua pagina)", false, righe.some((x) => x.id === "lead:l-2"));
    c("la frase dice cosa fare", true, /^Chiamare per confermare la consulenza/.test(r?.cosa ?? ""));
    c("porta l'ora della consulenza", "15:00", r?.ora);
    const oggi = "2026-10-30";
    c("sta in «Adesso», anche se la consulenza è nel pomeriggio", "adesso", DF.fasciaDi(r, ora.getTime(), oggi));
    //  In «Adesso» sta sopra a tutto il resto, anche a ciò che ha un'ora prima.
    const adesso = righe.filter((x) => DF.fasciaDi(x, ora.getTime(), oggi) === "adesso");
    c("e in «Adesso» sta in cima", "lead:l-1", DF.ordinaRighe(adesso)[0]?.id);
    c("ha un filtro con un nome e una spiegazione", true,
      DF.TIPI_RIGA.includes("conferma_meet") && !!DF.META_RIGA.conferma_meet.filtro && !!DF.META_RIGA.conferma_meet.spiegazione);
  }

  gruppo("CONSULENZE · (12) ASSENZA: «DA RIPROGRAMMARE» DA SOLO");
  {
    const d = scheda({ note: "nota di prima" });
    const INIZIO = Date.parse("2026-10-30T14:00:00.000Z");
    const MIN = 60_000;
    const quando = (min) => new Date(INIZIO + min * MIN);

    const e = K.decidiAssenza(d, quando(15), []);
    c("15' dopo l'inizio, nessuno in stanza: si sposta", "sposta", e?.tipo);
    c("…in «Da riprogrammare»", "da_spostare", e?.patch.stato);
    c("…con lo stato di prima (per tornare indietro)", "appuntamento_fissato", e?.patch.statoPrecedente);
    c("…e statoDal adesso (fa partire il messaggio dello stato)", quando(15).toISOString(), e?.patch.statoDal);
    c("…la nota di prima resta, quella nuova va in coda", true,
      e?.patch.note.startsWith("nota di prima\n") && e.patch.note.includes("15:00"));
    c("…la data della consulenza resta (la pagina Oggi la conta fra le non svolte)", undefined, e?.patch.dataMeeting);
    c("prima dei 15': niente", null, K.decidiAssenza(d, quando(14), []));
    c("oltre un'ora e mezza: niente (lo segna il consulente)", null, K.decidiAssenza(d, quando(91), []));
    c("è entrato in stanza (anche prima dell'inizio): resta com'è", "lascia",
      K.decidiAssenza(d, quando(20), [{ at: INIZIO - 5 * MIN }])?.tipo);
    c("una bussata di un altro giorno non conta", "sposta",
      K.decidiAssenza(d, quando(20), [{ at: INIZIO - 26 * 60 * MIN }])?.tipo);
    c("stanza non nostra (nessuna sala da leggere): resta com'è", "lascia",
      K.decidiAssenza(d, quando(20), null)?.tipo);
    c("ha scritto da poco («arrivo»): decide il consulente", "lascia",
      K.decidiAssenza(scheda({ contattoWa: cw(voce("ha_risposto", new Date(INIZIO + 10 * MIN).toISOString())) }), quando(20), [])?.tipo);
    c("esito già segnato (Cliente assente): niente", null, K.decidiAssenza({ ...d, stato: "no_show" }, quando(20), []));
    c("senza consulente: resta com'è", "lascia",
      K.decidiAssenza({ ...d, consulenteId: "" }, quando(20), [])?.tipo);
    c("appuntamento rifissato: vale anche lì", "sposta",
      K.decidiAssenza({ ...d, stato: "appuntamento_rifissato" }, quando(20), [])?.tipo);

    const dopo = { ...d, ...e.patch };
    c("la scheda spostata da sola si riconosce", true, K.eAssenzaAutomatica(dopo));
    c("…finché lo stato non cambia di nuovo", false,
      K.eAssenzaAutomatica({ ...dopo, statoDal: quando(40).toISOString() }));
    c("una scheda messa a mano in «Da riprogrammare» no", false,
      K.eAssenzaAutomatica({ ...d, stato: "da_spostare", statoDal: quando(15).toISOString() }));

    //  Il messaggio dello stato («Da riprogrammare», hgl_da_riprogrammare): di solito 30'
    //  dopo; per l'assenza automatica subito, cioè 15' dopo l'inizio.
    const consulenti = [{ id: "cons-1", data: { nome: "Filippo Demo", attivo: true, faConsulente: true } }];
    const ctx = {
      consulenti,
      invii: [],
      tetti: { ricontatti: 20, leadNuovi: 30, totale: 100 },
      fraseModuloDal: "2026-10-20T00:00:00.000Z",
      statiAccesi: { da_spostare: "2026-10-20T06:00:00.000Z" },
      indirizzoSede: null,
      prossimoDopo: null,
    };
    const okWhatsapp = { si: true, il: "2026-10-01T09:00:00.000Z", da: "Filippo Demo" };
    const auto = { id: "l-1", data: { ...dopo, okWhatsapp } };
    const aMano = { id: "l-1", data: { ...d, okWhatsapp, stato: "da_spostare", statoDal: quando(15).toISOString() } };
    c("assenza automatica: il messaggio parte subito", "invia",
      T.decidiPerStato([auto], quando(16), ctx)[0]?.tipo);
    c("…con la chiave del suo evento", `s|rp|330000001|${quando(15).toISOString()}`,
      T.decidiPerStato([auto], quando(16), ctx)[0]?.chiave);
    c("messo a mano: aspetta i 30' di sempre", "aspetta",
      T.decidiPerStato([aMano], quando(16), ctx)[0]?.tipo);
  }
}
