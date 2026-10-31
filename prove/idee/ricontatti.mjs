/** ── PROVE: «RICONTATTI» E IL PANNELLO FILTRI PIÙ SEMPLICE (31/10/2026) ───────
 *  Regole in src/crm/chatwa/ricontatti.ts e filtri.ts; il disegno in PannelloFiltri.tsx.
 *  Richiesta del titolare: una scorciatoia «Ricontatti» fra «Sconosciuti» e «Clienti» con tutti i
 *  lead a data (attesa acconto, da contattare, sta valutando…), dalla data più recente in giù,
 *  SOLO i propri anche per l'admin; e un pannello Filtri in cui non ci si perde.
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveRicontatti(mod, { c, gruppo, radice }) {
  const R = mod["chatwa/ricontatti"];
  const F = mod["chatwa/filtri"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");

  // ── Un piccolo mondo di chat finte ────────────────────────────────────────────────────────────
  let n = 0;
  const chat = (o = {}) => {
    n++;
    return {
      phone: `+39333111${String(n).padStart(4, "0")}`,
      lead: o.senzaScheda
        ? null
        : {
            data: {
              stato: o.stato ?? "sta_valutando",
              consulenteId: o.consulente === undefined ? "io" : o.consulente,
              dataRicontatto: o.data,
              oraRicontatto: o.ora,
            },
          },
      finestra: null,
      daRispondere: { attesa: false },
    };
  };
  const nessuno = () => 0;
  const con = (o) => ({ ...F.FILTRI_VUOTI, ...o });
  const tel = (l) => l.map((x) => x.phone);

  gruppo("RICONTATTI: CHI ENTRA");
  const STATI_DENTRO = [
    "da_ricontattare", // Ricontatto fissato
    "sta_valutando",
    "in_attesa_acconto",
    "gestire_in_chat",
    "da_contattare",
    "fissa_meet_dopo",
    "da_spostare",
    "richiamo",
    "ci_ricontatta_lui",
    "per_ora_no",
    "sede_disdetta",
  ];
  c(
    "ogni stato a data entra",
    STATI_DENTRO.map(() => true),
    STATI_DENTRO.map((s) => R.eRicontatto(chat({ stato: s }))),
  );
  const STATI_FUORI = [
    "attesa_whatsapp",
    "appuntamento_fissato",
    "appuntamento_rifissato",
    "viene_in_sede",
    "non_risponde",
    "segreteria",
    "venduto",
    "posa_in_sede",
    "no_show",
    "annullato",
  ];
  c(
    "gli altri stati no",
    STATI_FUORI.map(() => false),
    STATI_FUORI.map((s) => R.eRicontatto(chat({ stato: s }))),
  );
  c("un numero senza scheda non è un ricontatto", false, R.eRicontatto(chat({ senzaScheda: true })));
  c(
    "l'elenco segue la tabella del CRM: ogni stato che chiede dataRicontatto c'è",
    true,
    /QUANDO_PER_STATO/.test(senzaCommenti(leggi("src/crm/chatwa/ricontatti.ts"))) &&
      /chiaveData === "dataRicontatto"/.test(senzaCommenti(leggi("src/crm/chatwa/ricontatti.ts"))),
  );

  gruppo("RICONTATTI: ORDINE (la data più recente in alto)");
  const a = chat({ data: "2026-11-02" });
  const b = chat({ data: "2026-11-10" });
  const cc = chat({ data: "2026-10-20" });
  const senza = chat({});
  const senzaBis = chat({});
  c("dalla più recente alla più vecchia, senza data in fondo", tel([b, a, cc, senza, senzaBis]), tel(R.ordinaRicontatti([senza, a, cc, senzaBis, b])));
  const m9 = chat({ data: "2026-11-05", ora: "9:30" });
  const m15 = chat({ data: "2026-11-05", ora: "15:00" });
  const mSenzaOra = chat({ data: "2026-11-05" });
  const dopo = chat({ data: "2026-11-06" });
  c("nello stesso giorno l'ora più tarda sta sopra, senza ora in fondo al giorno", tel([dopo, m15, m9, mSenzaOra]), tel(R.ordinaRicontatti([mSenzaOra, m9, dopo, m15])));
  c("una data rotta vale «senza data»", tel([a, chat({ data: "2026-13-45" })].slice(0, 1)), tel(R.ordinaRicontatti([chat({ data: "ieri" }), a]).slice(0, 1)));
  const ingresso = [a, b];
  R.ordinaRicontatti(ingresso);
  c("non muta l'ingresso", tel([a, b]), tel(ingresso));
  c("a parità resta l'ordine di arrivo", tel([senza, senzaBis]), tel(R.ordinaRicontatti([senza, senzaBis])));

  gruppo("RICONTATTI: SOLO I PROPRI, ANCHE L'ADMIN");
  const mio = chat({ stato: "in_attesa_acconto", data: "2026-11-03", consulente: "io" });
  const suo = chat({ stato: "in_attesa_acconto", data: "2026-11-04", consulente: "anna" });
  const orfano = chat({ stato: "sta_valutando", data: "2026-11-04", consulente: null });
  const fuoriStato = chat({ stato: "appuntamento_fissato", consulente: "io" });
  const sconosciuto = chat({ senzaScheda: true });
  const mondo = [mio, suo, orfano, fuoriStato, sconosciuto];
  const dentro = (f) => tel(mondo.filter((x) => F.passaFiltri(x, f, nessuno)));
  c("con Ricontatti acceso passano solo i miei ricontatti", tel([mio]), dentro(con({ ricontatti: true, io: "io" })));
  c("quelli di un altro consulente no", false, F.passaFiltri(suo, con({ ricontatti: true, io: "io" }), nessuno));
  c("senza consulente nemmeno", false, F.passaFiltri(orfano, con({ ricontatti: true, io: "io" }), nessuno));
  c("un altro stato del mio no", false, F.passaFiltri(fuoriStato, con({ ricontatti: true, io: "io" }), nessuno));
  c("chi non è legato a nessun consulente (io vuoto): lista vuota", [], dentro(con({ ricontatti: true, io: "" })));
  c(
    "il menu consulente non aggira la regola: scegliere Anna non mostra i suoi",
    [],
    dentro(con({ ricontatti: true, io: "io", consulente: "anna" })).filter((t) => t === suo.phone),
  );
  c("e scegliere me stesso non cambia niente", tel([mio]), dentro(con({ ricontatti: true, io: "io", consulente: "io" })));
  c(
    "spento, Ricontatti non filtra niente (anche con io valorizzato)",
    tel(mondo),
    dentro(con({ io: "io" })),
  );
  c(
    "«io» da solo non è un filtro acceso (non conta sul tasto Filtri)",
    [0, 1],
    [F.contaAccesi(con({ io: "io" })), F.contaAccesi(con({ io: "io", ricontatti: true }))],
  );
  const lunga = [mio, suo, orfano];
  c(
    "il numero della pastiglia è «cosa vedresti»: solo i miei",
    1,
    F.contaVoce(lunga, con({ io: "io" }), nessuno, "ricontatti", true),
  );
  c("e con io vuoto è zero, onesto", 0, F.contaVoce(lunga, con({ io: "" }), nessuno, "ricontatti", true));
  c(
    "il conteggio degli altri filtri non è toccato da io",
    F.contaVoce(lunga, con({}), nessuno, "tipo", "con-scheda"),
    F.contaVoce(lunga, con({ io: "io" }), nessuno, "tipo", "con-scheda"),
  );

  gruppo("RICONTATTI: COME TUTTI GLI ALTRI FILTRI (esclusivo, salvataggio)");
  const acceso = F.commuta(con({ io: "io", consulente: "anna" }), "ricontatti", true);
  c("toccarlo lo accende", true, F.eAcceso(acceso, "ricontatti", true));
  c("il consulente scelto resta ricordato, io non si perde", ["anna", "io"], [acceso.consulente, acceso.io]);
  c("toccarlo di nuovo lo spegne", false, F.commuta(acceso, "ricontatti", true).ricontatti);
  c("toccare un'altra voce lo spegne", false, F.commuta(acceso, "coda", "da-rispondere").ricontatti);
  c("e viceversa: accendere Ricontatti spegne le stelle", false, F.commuta(con({ stelle: true }), "ricontatti", true).stelle);
  c("compare fra le etichette accese", "Ricontatti", F.etichetteAccese(acceso, (x) => x)[0].etichetta);
  const giro = F.leggiFiltri(F.scriviFiltriSessione(acceso), "anna");
  c("si ricorda nella scheda del browser", true, giro.ricontatti);
  c("ma «io» non si salva mai: lo rimette la pagina ad ogni apertura", [false, ""], [JSON.stringify(JSON.parse(F.scriviFiltriSessione(acceso))).includes('"io"'), giro.io]);
  c("un valore salvato strano non lo accende", false, F.leggiFiltri(JSON.stringify({ ricontatti: "sì" }), null).ricontatti);
  c("se ne trova più d'uno ne tiene uno solo", 1, F.contaAccesi(F.leggiFiltri(JSON.stringify({ ricontatti: true, coda: "da-chiamare", stelle: true }), null)));
  c("filtriValidi mette «io» senza toccare il resto", ["io", "anna", true], ((f) => [f.io, f.consulente, f.ricontatti])(F.filtriValidi(acceso, new Set(["anna"]), "io")));
  c("filtriValidi senza io lo lascia vuoto", "", F.filtriValidi(con({}), new Set(), undefined).io);
  c(
    "in Ricontatti il consulente scelto prima non conta e non ha la sua etichetta",
    [1, ["Ricontatti"]],
    [F.contaAccesi(acceso), F.etichetteAccese(acceso, (x) => x).map((e) => e.etichetta)],
  );
  c("Azzera spegne anche Ricontatti", 0, F.contaAccesi(F.FILTRI_VUOTI));

  gruppo("RICONTATTI: LA PASTIGLIA NELLA RIGA");
  const nomiRiga = F.VOCI_RIGA.map((v) => v.nome);
  c(
    "sta fra «Sconosciuti» e «Clienti»",
    true,
    nomiRiga.indexOf("Sconosciuti") + 1 === nomiRiga.indexOf("Ricontatti") &&
      nomiRiga.indexOf("Ricontatti") + 1 === nomiRiga.indexOf("Clienti"),
  );
  c("la voce è acceso/spento sul campo ricontatti", true, F.VOCI_RIGA.some((v) => v.nome === "Ricontatti" && v.campo === "ricontatti" && v.valore === true));
  c("ogni voce della riga (tranne le pastiglie per stato) ha una voce nei gruppi (le prove esclusive le percorrono tutte)", true, F.VOCI_RIGA.filter((v) => !String(v.valore).startsWith("stato:")).every((v) => F.GRUPPI_FILTRI.some((g) => g.voci.some((x) => x.campo === v.campo && x.valore === v.valore))));

  gruppo("PANNELLO FILTRI PIÙ SEMPLICE: STRUTTURA");
  const pannello = leggi("src/crm/chatwa/PannelloFiltri.tsx");
  const vivo = senzaCommenti(pannello);
  const titoli = F.GRUPPI_FILTRI.map((g) => g.titolo);
  c("titoli brevi, al massimo due parole", true, titoli.every((t) => t.split(" ").length <= 3));
  c("il pannello ha «Consulente» e «Altri filtri» (Stato e Finestra 24h vengono dai gruppi)", true, /titolo="Consulente"/.test(vivo) && /Altri filtri/.test(vivo));
  c("«Stato» e «Finestra 24h» sono gruppi di dati", true, ["Stato", "Finestra 24h"].every((t) => titoli.includes(t)));
  const fuoriRiga = F.GRUPPI_FILTRI.flatMap((g) => g.voci).filter((v) => !F.VOCI_RIGA.some((r) => r.campo === v.campo && r.valore === v.valore));
  c(
    "nel pannello restano solo le voci che la riga non ha",
    ["Attesa WhatsApp", "Per ora no", "Acconto versato", "Si può scrivere", "Finestra chiusa", "Con scheda"],
    fuoriRiga.map((v) => v.nome),
  );
  c("il pannello non conosce un secondo elenco: deriva dalla riga (voceInRiga)", true, /voceInRiga\(/.test(vivo));
  c("un solo «Azzera» nel pannello", 1, (vivo.match(/>\s*Azzera\s*</g) ?? []).length);
  c("niente più paragrafo di spiegazione fisso in cima", false, /Un filtro alla volta: scegliendone un altro, il primo si spegne/.test(vivo));
  c("«Altri filtri» è chiuso di partenza e si apre da solo con un filtro dentro", true, /useState\(false\)/.test(vivo) && /aria-expanded=\{apertoAltri\}/.test(vivo));
  c("il piede chiude: «Mostra N chat»", true, /Mostra 1 chat/.test(vivo) && /Mostra \$\{mostra\} chat/.test(vivo));
  c("tocchi da 44 px su ogni voce", true, /ALTEZZA_TASTO/.test(vivo) && /min-h-11/.test(vivo));
  c("le frasi di spiegazione sono corte (max 60 caratteri)", true, fuoriRiga.every((v) => v.spiega.length > 20 && v.spiega.length <= 60));
  c("il consulente non c'è quando Ricontatti è acceso: vale solo il tuo", true, /filtri\.ricontatti/.test(vivo));
  c("il tasto «Filtri» ha il contatore", true, /<Contatore n=\{accesi\} acceso \/>/.test(vivo));
  c("le voci già nella riga non tornano fra gli altri stati", true, /altriStati[\s\S]{0,200}VOCI_RIGA|VOCI_RIGA[\s\S]{0,300}altriStati|fuoriRiga/.test(vivo));

  gruppo("RICONTATTI: COLLEGAMENTO NELL'ELENCO");
  const elenco = leggi("src/crm/chatwa/ElencoChat.tsx");
  const elVivo = senzaCommenti(elenco);
  c("l'elenco ordina con ordinaRicontatti", true, /ordinaRicontatti\(/.test(elVivo));
  c("«io» è chi ha digitato il PIN (useConsulenteCollegato), senza eccezione per l'admin", true, /useConsulenteCollegato\(\)/.test(elVivo) && /filtriValidi\(\s*filtriSalvati,\s*consulentiNoti,\s*io/.test(elVivo));
  c("niente blocco «Acconto, da installare» dentro Ricontatti (compare solo col filtro Acconto, esclusivo)", true, /tutte && filtri\.acconto/.test(elVivo));
  c("frase sincera quando non sei legato a nessun consulente", true, /fraseRicontattiVuoti\(/.test(elVivo));
  c("passaFiltri resta l'unica porta dei filtri (nessuna regola riscritta nell'elenco)", true, /passaFiltri\(c, filtri, stelleDi\)/.test(elVivo) && !/eMioRicontatto|eRicontatto\(/.test(elVivo));
}
